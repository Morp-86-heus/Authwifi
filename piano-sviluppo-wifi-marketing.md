# Piano di sviluppo — Piattaforma WiFi Marketing per strutture ricettive

**Gateway di riferimento: TP-Link Omada** (controller software/hardware OC200/OC300 o controller self-hosted)

---

## 1. Visione del prodotto

Piattaforma SaaS multi-tenant che trasforma il WiFi ospiti delle strutture ricettive in uno strumento di marketing e reputation management:

- Captive portal brandizzato con raccolta dati GDPR-compliant
- Profilazione ospiti con segmenti/sotto-segmenti e CRM integrato
- Survey automatiche post-soggiorno e invito alle recensioni
- Campagne email/SMS/WhatsApp su liste profilate
- Dashboard analytics per il gestore

**Mercato target iniziale:** hotel 3-4 stelle, B&B strutturati, stabilimenti balneari e ristoranti in Italia.

---

## 2. Architettura di riferimento

```
[Ospite] → [AP Omada] → [Omada Controller] ⇄ [External Portal Server (nostro)]
                                  │
                                  ▼
                       [Backend SaaS multi-tenant]
                  CRM · Segments · Survey · Reputation
                                  │
                  PostgreSQL · Redis · Message Queue
                                  │
              Email (SendGrid) · SMS/WA (Twilio) · Push
```

### 2.1 Integrazione Omada — External Portal Server

Omada supporta il **portale esterno**: il controller reindirizza il client non autenticato verso il nostro server, che dopo il login chiama l'API del controller per autorizzare il client.

**Flusso tecnico:**

1. Il client si connette all'SSID ospiti → il controller intercetta il traffico HTTP
2. Redirect verso il nostro portale con parametri in query string: `clientMac`, `apMac`, `ssidName`, `radioId`, `site`, `redirectUrl`
3. L'ospite compila il form (email, consensi, mini-questionario profilazione)
4. Il nostro backend effettua login sull'API del controller Omada (`POST /api/v2/hotspot/login`) e ottiene il token CSRF + cookie di sessione
5. Chiamata di autorizzazione: `POST /api/v2/hotspot/extPortal/auth` con `clientMac`, `apMac`, `ssidName`, `site`, `time`, `authType: 4`
6. Il controller sblocca il client → redirect verso landing post-login

### 2.2 Stack tecnologico (stack reale in produzione)

> **Nota:** Il piano originale prevedeva NestJS + Prisma. Durante lo sviluppo lo stack backend è stato migrato a FastAPI + SQLAlchemy per maggiore controllo sulle query, gestione asincrona nativa e migrazioni idempotenti.

| Componente | Tecnologia | Note |
|---|---|---|
| Backend API | **FastAPI** (Python 3.12) | Router modulari, Pydantic v2, async handlers |
| ORM | **SQLAlchemy 2.x** | Mapped columns, Mapped[], relationship() |
| Migrazioni DB | **Alembic** | Raw SQL con `IF NOT EXISTS` per coesistenza con `create_all()` |
| Frontend dashboard | **React 18 + Vite + Tailwind CSS** | TypeScript, lucide-react, axios |
| State management | **Zustand** + localStorage | Auth token persistito |
| Splash page | **HTML/JS vanilla server-rendered** | Render Python f-string, captive-portal compatible |
| Database | **PostgreSQL 16** | Porta 9999, colonna `tenant_id` su ogni tabella |
| Cache | **Redis 7** | Connesso ma non ancora utilizzato (todo) |
| Message queue | **RabbitMQ 3.13** | Connesso, pronto per campagne asincrone |
| HTTP client Omada | **httpx** (AsyncClient condiviso) | Timeout 15s, connessioni riutilizzate |
| Auth gestori | **JWT** (python-jose) + bcrypt | Token 8h, ruoli: superadmin/owner/manager/staff |
| Infra | **Docker Compose** | Backend :8000, Frontend :3000, Postgres :9999 |
| VCS | **Git** → GitHub `Morp-86-heus/Authwifi` | Branch `master` |

### 2.3 Data layer

- **PostgreSQL** — schema multi-tenant (colonna `tenant_id` su ogni tabella, 16 indici su FK columns)
- **Redis** — disponibile, da usare per: cache splash page, sessioni Omada, rate limiting
- **RabbitMQ** — disponibile, da usare per: invii asincroni email/SMS, webhook, retry

### 2.4 Struttura del progetto (reale)

```
Authwifi/
├── backend/                            # FastAPI (porta 8000)
│   ├── main.py                         # App FastAPI, include_router
│   ├── models.py                       # SQLAlchemy: Tenant, Manager, Site, Guest,
│   │                                   #   WifiSession, Consent, Segment, SubSegment,
│   │                                   #   MacBlacklist, MacWhitelist, ManagerSite
│   ├── auth.py                         # JWT, bcrypt, get_current_manager, require_roles
│   ├── database.py                     # Engine con pool_size=20, max_overflow=40
│   ├── alembic/
│   │   └── versions/
│   │       ├── 001_initial.py          # Schema base (già applicato via create_all)
│   │       ├── 002_segments.py         # Tabelle segments, sub_segments + FK su guests
│   │       ├── 003_indexes.py          # 16 indici performance su tutte le FK columns
│   │       ├── 004_survey.py           # survey_responses, surveyEmailSentAt, surveyEnabled, surveyHoursDelay
│   │       └── 005_reviews.py          # external_reviews, googlePlaceId su sites
│   ├── routers/
│   │   ├── auth.py                     # POST /auth/login
│   │   ├── tenants.py                  # CRUD tenant
│   │   ├── sites.py                    # CRUD siti + upload immagini
│   │   ├── managers.py                 # CRUD manager con validazione site_ids
│   │   ├── crm.py                      # Ospiti: lista paginata, dettaglio, export CSV
│   │   ├── stats.py                    # KPI dashboard per sito
│   │   ├── segments.py                 # CRUD segmenti e sotto-segmenti
│   │   ├── portal.py                   # GET /splash + POST /login + GET /welcome
│   │   ├── whitelist.py                # MAC whitelist per sito
│   │   ├── blacklist.py                # MAC blacklist per sito
│   │   ├── superadmin.py              # Gestione platform-level
│   │   ├── survey.py                   # NPS form pubblico, stats, send-test
│   │   └── reviews.py                  # Recensioni Google: lista + sync Places API
│   ├── workers/
│   │   ├── survey_scheduler.py         # Pubblica su RabbitMQ ogni ora (LATERAL JOIN)
│   │   └── survey_sender.py            # Consuma da RabbitMQ, genera JWT, invia email
│   └── services/
│       ├── splash.py                   # render_splash(): HTML server-rendered
│       ├── omada.py                    # OmadaClient: get_session + authorize_client
│       ├── email.py                    # send_survey_email() via SendGrid (mock se no key)
│       ├── google_places.py            # fetch_google_reviews() via Places API
│       └── rabbitmq.py                 # publish_survey() + consume_survey()
├── apps/
│   ├── api/                            # Legacy NestJS (non in uso in produzione)
│   └── dashboard/                      # React + Vite + Tailwind (porta 3000)
│       └── src/
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── DashboardPage.tsx
│           │   ├── GuestsPage.tsx
│           │   ├── ManagersPage.tsx
│           │   ├── SegmentsPage.tsx    # Gestione segmenti/sotto-segmenti
│           │   ├── SettingsPage.tsx    # Tab: Branding, Omada, Login, Whitelist, Blacklist, Social, Survey
│           │   ├── SurveyPage.tsx      # Tab: NPS & Feedback, Recensioni Google
│           │   └── SuperAdminPage.tsx
│           ├── components/
│           │   ├── GuestDetail.tsx     # Slide-over con sezione Profilazione
│           │   ├── ImageUploader.tsx
│           │   └── WorldMap.tsx
│           └── layouts/
│               └── AppLayout.tsx       # Sidebar con voci: Segmenti, Survey & NPS
├── docker-compose.yml
├── .env                                # JWT_SECRET (>=32 char), DATABASE_URL, OMADA_*
└── tsconfig.base.json
```

---

## 3. Compliance e sicurezza

- **GDPR**: consensi granulari (marketing, profilazione, terze parti) registrati con timestamp e versione informativa; soft-delete ospiti (`deletedAt`); diritto all'oblio implementabile
- **Data retention**: log di connessione (WifiSession) separati dai dati marketing (Guest)
- **Sicurezza**: isolamento tenant a livello query su ogni endpoint, JWT obbligatorio, bcrypt per password, nessun fallback in chiaro
- **Multi-tenant isolation**: ogni endpoint verifica `tenant_id` nel DB — nessun IDOR possibile tra tenant
- **Normativa italiana**: nessun obbligo generalizzato di identificazione, log di autenticazione conservati

### Variabili d'ambiente rilevanti (`.env`)

```env
JWT_SECRET="<random 32+ chars>"          # OBBLIGATORIO — il backend non si avvia senza
DATABASE_URL="postgresql://authwifi:authwifi@postgres:9999/authwifi"
NODE_ENV="production"                     # abilita verifica SSL verso Omada
OMADA_CONTROLLER_URL="https://..."
OMADA_OMADAC_ID="..."
OMADA_OPERATOR_USERNAME="..."
OMADA_OPERATOR_PASSWORD="..."

# Fase 2 — Survey e Recensioni
RABBITMQ_URL="amqp://authwifi:authwifi@rabbitmq:5672/"
BASE_URL="https://tuodominio.it"          # usato per generare l'URL della survey nell'email
SENDGRID_API_KEY="SG...."                # se assente, le email sono loggate come mock
SENDGRID_FROM_EMAIL="noreply@tuodominio.it"
SENDGRID_FROM_NAME="Nome Struttura"
GOOGLE_PLACES_API_KEY="AIza..."          # opzionale — per sync recensioni Google
SCHEDULER_INTERVAL_SECONDS=3600          # ogni quante secondi il scheduler cerca nuovi invii
```

### Comandi utili

```bash
# Rebuild e avvio (dal root del progetto, sul server)
docker compose build backend && docker compose up -d backend

# Applica migrazioni DB
docker compose exec backend alembic upgrade head

# Log backend in tempo reale
docker logs authwifi-backend -f

# Generare JWT_SECRET sicuro
openssl rand -hex 32
```

---

## 4. Roadmap di sviluppo

### Fase 0 — Setup e spike tecnico ✅ COMPLETATA

- [x] Repo monorepo (`apps/api`, `apps/dashboard`) con `tsconfig.base.json`
- [x] Docker Compose: Postgres 16 (porta 9999), Redis 7, RabbitMQ 3.13
- [x] Spike flusso completo Omada: redirect → splash → login → `extPortal/auth` → sblocco client
- [x] Verifica end-to-end su hardware reale (OC200 + EAP)
- [x] **Migrazione stack:** da NestJS/Prisma a FastAPI/SQLAlchemy/Alembic

**Deliverable:** POC funzionante di login WiFi con raccolta email su hardware Omada reale. ✅

---

### Fase 1 — MVP captive portal + dashboard ✅ COMPLETATA

#### Backend (FastAPI)

- [x] `GET /portal/splash` — rendering HTML server-rendered con branding, segmenti, returning guest
- [x] `POST /portal/login` — autorizzazione Omada, upsert ospite, consensi GDPR, profilazione
- [x] `GET /portal/welcome` — pagina post-login con link social
- [x] Splash template: logo, hero banner, sfondo, colori, testi, social links
- [x] Metodi di login: email + consensi GDPR, click-through
- [x] MAC whitelist bypass (accesso diretto senza form)
- [x] MAC blacklist (accesso negato con pagina di errore)
- [x] `POST /auth/login` — JWT per gestori
- [x] `GET/POST /tenants`, CRUD completo
- [x] `GET/POST /sites`, `GET /sites/:id`, `PATCH /sites/:id`
- [x] `POST /sites/:id/upload/:field` — upload immagini (logo, hero, background)
- [x] `GET /stats/:siteId` — KPI dashboard
- [x] `GET /crm/guests` — lista paginata con ricerca, sessioni, ultima visita (2 query totali, no N+1)
- [x] `GET /crm/guests/:id` — dettaglio ospite con sessioni e consensi GDPR
- [x] `GET /crm/guests/export` — export CSV streaming con BOM UTF-8, batch 500 righe
- [x] CRUD Manager con ruoli (owner/manager/staff) e assegnazione siti
- [x] CRUD Whitelist/Blacklist per sito
- [x] SuperAdmin: gestione platform-level (sospensione, licenze, tenant)
- [x] Alembic migration 003: 16 indici su tutte le FK columns

#### Dashboard (React + Vite + Tailwind)

- [x] Login gestore con JWT e persistenza Zustand + localStorage
- [x] Layout con sidebar: Overview, Ospiti, Segmenti, Manager, Impostazioni
- [x] Pagina Overview: KPI card, grafico registrazioni ultimi 30 giorni, mappa paesi, ospiti recenti
- [x] Pagina Ospiti: tabella paginata con ricerca, slide-over dettaglio (sezione Profilazione)
- [x] Pagina Impostazioni: tab Branding, Omada, Login methods
- [x] Componente `ImageUploader`: drag&drop, preview, validazione MIME
- [x] Pagina Manager: CRUD con assegnazione siti
- [x] Pagina SuperAdmin: gestione tenant, sospensione, estensione licenze

**Deliverable:** prodotto installabile in una struttura pilota. ✅

---

### Fase 1.5 — Profilazione ospiti ✅ COMPLETATA (aggiunta al piano)

> Feature non prevista nel piano originale, implementata su richiesta.

- [x] Modello `Segment`: nome, priorità, enabled, tenant scoped
- [x] Modello `SubSegment`: testo italiano (etichetta splash), date start/end, ricorrente, enabled
- [x] Alembic migration 002: tabelle `segments`, `sub_segments`, FK su `guests`
- [x] `GET/POST /segments` — CRUD segmenti con paginazione
- [x] `GET/POST /segments/sub-segments` — CRUD sotto-segmenti con contatore ospiti online (1 query GROUP BY)
- [x] Splash page: mini-questionario opzionale con 2 select dinamici (JS filtering lato client)
- [x] POST /login: salva `segment_id` e `sub_segment_id` sull'ospite
- [x] Dettaglio ospite: sezione "Profilazione" con Tipologia e Interessi
- [x] Dashboard: pagina Segmenti (SegmentsPage) con CRUD, modal add/edit, toggle enable, paginazione

**Deliverable:** profilazione ospiti operativa end-to-end. ✅

---

### Fase 1.6 — Security hardening ✅ COMPLETATA (aggiunta al piano)

> Risultato della code review approfondita post-implementazione.

- [x] Fix IDOR critico su `GET/PATCH /sites/{id}`: aggiunto filtro `tenant_id` — un tenant non può leggere/modificare i siti di un altro (incluse credenziali Omada)
- [x] Fix IDOR critico su `POST /sites/{id}/upload`: aggiunto `can_access_site` + filtro `tenant_id` — l'endpoint era completamente aperto
- [x] Rimosso fallback plaintext in `verify_password` — le password erano verificabili in chiaro se non bcrypt
- [x] JWT_SECRET obbligatorio ≥ 32 caratteri — il backend non si avvia senza
- [x] Export CSV: aggiunto filtro `site_ids` per manager/staff scoped a siti specifici
- [x] Manager site assignment: validazione che i `site_ids` appartengano al tenant corrente
- [x] Whitelist/Blacklist: aggiunto filtro `tenant_id` di defense-in-depth
- [x] `.gitignore`: esclude `.env`, `node_modules/`, `dist/`, `public/uploads/`

**Deliverable:** isolamento multi-tenant verificato, nessun IDOR tra tenant. ✅

---

### Fase 1.7 — Scalability fixes ✅ COMPLETATA (aggiunta al piano)

> Risultato del scalability audit per migliaia di tenant.

- [x] `list_guests`: da 2N query → 2 query totali (GROUP BY + DISTINCT ON PostgreSQL)
- [x] `export_csv`: da N+1 per riga → batch 500 con bulk queries, vero streaming
- [x] `list_sub_segments`: da N COUNT → 1 GROUP BY + joinedload per segment.name
- [x] Connection pool: `pool_size=20`, `max_overflow=40`, `pool_recycle=1800` (da default 5+10)
- [x] OmadaClient: client httpx condiviso (no TLS handshake per ogni chiamata), timeout 15s
- [x] Alembic migration 003: 16 indici su tutte le FK columns
  - `managers.tenantId`, `sites.tenantId`, `guests.(tenantId,createdAt) WHERE deletedAt IS NULL`
  - `guests.segmentId`, `guests.subSegmentId`
  - `wifi_sessions.guestId`, `wifi_sessions.(siteId,startedAt)`, `wifi_sessions.macAddress`
  - `consents.guestId`, `segments.tenantId`, `sub_segments.(tenantId,segmentId)`
  - `mac_blacklist.tenantId`, `mac_whitelist.tenantId`, `manager_sites.siteId`

**Deliverable:** stack verificato per migliaia di tenant, nessun N+1 sui path critici. ✅

---

### Fase 2 — Survey e recensioni ✅ COMPLETATA

#### Backend

- [x] Modello `SurveyResponse`: id, guest_id, site_id, tenant_id, nps_score, comment, survey_token (JWT), submitted_at
- [x] Modello `ExternalReview`: id, site_id, tenant_id, source, external_id, author_name, author_photo, rating, text, published_at, fetched_at
- [x] Alembic migration 004: tabella `survey_responses`, colonne `surveyEmailSentAt` su guests, `surveyEnabled`/`surveyHoursDelay` su sites
- [x] Alembic migration 005: tabella `external_reviews`, colonna `googlePlaceId` su sites
- [x] `GET /survey/{token}` — form NPS pubblico (0-10 + commento), renderizzato server-side
- [x] `POST /survey/{token}` — salva risposta; NPS≥9 → link recensione Google, NPS≤6 → messaggio staff
- [x] `GET /survey/responses` — statistiche NPS autenticate (avgNps, promotori/passivi/detrattori %)
- [x] `POST /survey/send-test` — invia email di test al manager loggato
- [x] `GET /reviews` — lista recensioni esterne con avgRating e lastSync
- [x] `POST /reviews/sync` — sync da Google Places API con upsert su `externalId`
- [x] `services/email.py` — `send_survey_email()` via SendGrid, fallback mock su log se no API key
- [x] `services/google_places.py` — `fetch_google_reviews()` via Places Details API, external_id = sha256(author:ts)[:24]
- [x] `services/rabbitmq.py` — `publish_survey()` / `consume_survey()` con pika
- [x] `workers/survey_scheduler.py` — ogni N ore, LATERAL JOIN per trovare ospiti eleggibili, pubblica su RabbitMQ
- [x] `workers/survey_sender.py` — consuma da RabbitMQ, genera JWT survey token, crea SurveyResponse (pending), invia email
- [x] docker-compose.yml: servizi `survey-scheduler` e `survey-sender` con healthcheck su postgres + rabbitmq

#### Dashboard

- [x] `SurveyPage.tsx` — tab "NPS & Feedback" (4 KPI card, barra colori, lista risposte) + tab "Recensioni Google" (avg rating, sync button, lista recensioni con avatar)
- [x] `SettingsPage.tsx` — tab "Survey": toggle abilitazione, Google Place ID, ore delay, email di test, review funnel card
- [x] Sidebar: voce "Survey & NPS" con icona `MessageSquareDot`

#### Fix post-deploy

- [x] Bug: `current["id"]` → `current["manager_id"]` in `POST /survey/send-test` (KeyError 500)

**Deliverable:** ciclo completo soggiorno → survey NPS → email → form → recensione Google (se NPS≥9). ✅

---

### Fase 3 — Marketing automation (4-6 settimane) ⏳ DA IMPLEMENTARE

- [ ] Campaign engine: builder segmenti avanzato (lingua, nazionalità, data soggiorno, ritorni, profilo)
- [ ] Editor email (template predefiniti + MJML)
- [ ] Canale SMS/WhatsApp via Twilio
- [ ] Automazioni: compleanno, anniversario soggiorno, pre-stagione
- [ ] Reportistica campagne (open rate, CTR, conversioni)
- [x] ~~Export CSV lista ospiti~~ ✅ già implementato (Fase 1)

**Prerequisiti tecnici:** RabbitMQ ✅ già attivo, Redis per deduplicazione, worker asincrono Python.

**Deliverable:** suite di marketing utilizzabile in autonomia dal gestore.

---

### Fase 4 — Reputation e billing (4-6 settimane) ⏳ DA IMPLEMENTARE

- [ ] Aggregatore recensioni multi-piattaforma (Google, TripAdvisor, Booking)
- [ ] Sentiment analysis sui feedback
- [ ] Widget recensioni embeddabile sul sito della struttura
- [ ] Cifratura credenziali Omada (vault o colonne cifrate in DB)
- [ ] Billing e piani (Stripe): checkout, webhook, aggiornamento `plan` e `planExpiresAt`
- [ ] Load testing con migliaia di tenant simulati

**Deliverable:** prodotto commercializzabile con pricing a tier.

---

### Fase 5 — Estensioni (backlog) ⏳ BACKLOG

- App mobile ospite (guida struttura, push geolocalizzate)
- Supporto gateway aggiuntivi (UniFi, MikroTik, Cambium) tramite adapter pattern
- Integrazione PMS (Opera, Scrigno, Slope) per dati check-in/check-out
- AI: risposta automatica alle recensioni, insight sui feedback
- Seamless re-login per MAC noti (ospiti di ritorno senza form)
- **Redis cache per splash page** (elimina 7 query DB per ogni caricamento) — **prossimo step**
- Migrazione SQLAlchemy async (AsyncSession + asyncpg) per eliminare blocking I/O su handler async

---

## 5. Debito tecnico noto

| Voce | Dettaglio | Priorità |
|---|---|---|
| Redis inutilizzato | Connesso ma mai usato. La splash page fa 7 query DB per ogni load. Con cache Redis si scende a 0. | Alta |
| SQLAlchemy sincrono in `async def` | I router `portal.py` sono `async def` ma usano SQLAlchemy sync: ogni query blocca l'event loop. Fix: migrare a `AsyncSession` + `asyncpg`. | Media |
| Stats senza cache | 5-6 `COUNT`/`GROUP BY` su ogni caricamento dashboard, nessuna cache. Con Redis TTL 5min sparisce il carico. | Media |
| `top_countries` illimitato | `stats.py`: `GROUP BY country` su tutta la storia del tenant senza data filter. Aggiungere LIMIT o finestra temporale. | Bassa |
| Credenziali Omada in chiaro | `omadaOperatorPass` è in chiaro nel DB. In Fase 4: cifrare con KMS o vault. | Bassa (pre go-live) |

---

## 6. Rischi principali

| Rischio | Mitigazione |
|---|---|
| Cambi API Omada tra versioni controller | Pin della versione controller supportata, layer di astrazione in `services/omada.py` |
| Captive portal detection inconsistente | Test matrix dispositivi reali (già verificato in Fase 0) |
| Deliverability email scarsa | Dominio dedicato, warm-up, SPF/DKIM/DMARC fin dal giorno 1 |
| GDPR non conforme | Consensi granulari già implementati; coinvolgere consulente privacy prima del go-live pubblico |
| JWT_SECRET in produzione debole | Obbligatorio ≥32 char, il backend non si avvia senza; usare `openssl rand -hex 32` |

---

## 7. Metriche di successo MVP

- Tempo di onboarding nuova struttura < 1 giorno
- Tasso di completamento login portale > 85%
- Tempo caricamento splash page < 1,5 s (target: < 0,5s con Redis cache)
- Uptime servizio auth > 99,9%
- Prima struttura pilota attiva entro fine Fase 1 ✅
