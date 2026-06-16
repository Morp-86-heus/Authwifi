# Piano di sviluppo — Piattaforma WiFi Marketing per strutture ricettive

**Gateway di riferimento: TP-Link Omada** (controller software/hardware OC200/OC300 o controller self-hosted)

---

## 1. Visione del prodotto

Piattaforma SaaS multi-tenant che trasforma il WiFi ospiti delle strutture ricettive in uno strumento di marketing e reputation management:

- Captive portal brandizzato con raccolta dati GDPR-compliant
- Profilazione ospiti e CRM integrato
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
                  CRM · Campaign · Survey · Reputation
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
3. L'ospite compila il form (email, social login, WhatsApp) e accetta i consensi
4. Il nostro backend effettua login sull'API del controller Omada (`POST /api/v2/hotspot/login` con operator hotspot dedicato) e ottiene il token CSRF + cookie di sessione
5. Chiamata di autorizzazione: `POST /api/v2/hotspot/extPortal/auth` con `clientMac`, `apMac`, `ssidName`, `site`, `time` (durata sessione in ms), `authType: 4`
6. Il controller sblocca il client → redirect dell'ospite verso landing post-login (promo, app, ecc.)

**Note operative:**

- Creare un account **Hotspot Operator** dedicato sul controller per le chiamate API (non usare l'admin)
- Il controller deve raggiungere/essere raggiunto dal portale: per multi-sede conviene un **controller centralizzato** (self-hosted su VPS o Omada Cloud-Based Controller) oppure OC200 per sede con VPN/port-forwarding verso il nostro backend
- Gestire il rinnovo sessione e la riautenticazione automatica per MAC noti (seamless login per ospiti di ritorno)
- HTTPS obbligatorio sul portale; attenzione al *captive portal detection* di iOS/Android (endpoint `captive.apple.com`, `connectivitycheck.gstatic.com`)

### 2.2 Backend (core platform)

| Servizio | Responsabilità |
|---|---|
| API Gateway | Routing, JWT, rate limiting, tenant resolution |
| Auth service | Login gestori (OAuth2/Keycloak), social login ospiti |
| Portal service | Rendering splash page, handshake con Omada API |
| CRM engine | Profili ospiti, deduplica per MAC/email, segmentazione |
| Survey engine | Questionari NPS/CSAT, trigger post check-out |
| Campaign engine | Automazioni (regole evento→azione), invii schedulati |
| Reputation service | Aggregazione recensioni Google/TripAdvisor/Booking |
| Notification service | Dispatcher email/SMS/WhatsApp/push |
| Analytics service | KPI, report, export |

### 2.3 Data layer

- **PostgreSQL** — schema multi-tenant (colonna `tenant_id` + Row Level Security, oppure schema-per-tenant per i clienti enterprise)
- **Redis** — sessioni portale, cache token Omada, rate limiting
- **Message queue** (RabbitMQ) — invii asincroni, webhook, retry
- **Object storage** (S3-compatibile) — loghi, asset splash page, export

### 2.4 Stack tecnologico

| Componente | Scelta | Note |
|---|---|---|
| Backend | NestJS + Fastify | TypeScript, moduli, guard JWT |
| Frontend dashboard | React + Vite + Tailwind | Porta 5174 in dev |
| Splash page | HTML/JS vanilla server-rendered | Captive-portal compatible |
| ORM | Prisma | Migrazioni e type-safety |
| Auth gestori | JWT (passport-jwt) | Da evolvere verso Keycloak in Fase 4 |
| Email | SendGrid | Da integrare in Fase 2 |
| SMS/WhatsApp | Twilio | Da integrare in Fase 3 |
| Infra | Docker Compose | Postgres 16 su porta 9999, Redis 7, RabbitMQ 3.13 |

---

## 3. Compliance e sicurezza

- **GDPR**: consensi granulari (marketing, profilazione, terze parti) registrati con timestamp e versione informativa; diritto all'oblio (cancellazione profilo + anonimizzazione log); DPA con i provider (SendGrid, Twilio)
- **Data retention**: log di connessione separati dai dati marketing; policy di conservazione configurabile per tenant
- **Sicurezza**: isolamento tenant a livello query (RLS), secrets in vault, TLS ovunque, audit log delle azioni gestore
- **Normativa italiana**: nessun obbligo generalizzato di identificazione (decreto Pisanu superato), ma conservare i log di autenticazione è buona pratica; valutare requisiti specifici per strutture ricettive

---

## 4. Roadmap di sviluppo

### Fase 0 — Setup e spike tecnico ✅ COMPLETATA

- [x] Repo monorepo (`apps/api`, `apps/dashboard`) con `tsconfig.base.json`
- [x] Docker Compose: Postgres 16 (porta 9999), Redis 7, RabbitMQ 3.13
- [x] NestJS + Fastify bootstrap — moduli: Auth, Tenant, Portal, CRM, Health
- [x] Schema Prisma v1: Tenant, Manager, Site, Guest, WifiSession, Consent
- [x] Spike flusso completo Omada: redirect → splash → login → `extPortal/auth` → sblocco client
- [x] Verifica end-to-end su hardware reale (OC200 + EAP)

**Deliverable:** POC funzionante di login WiFi con raccolta email su hardware Omada reale. ✅

---

### Fase 1 — MVP captive portal + dashboard ✅ COMPLETATA

#### Backend

- [x] `GET /portal/splash` — rendering splash page HTML server-rendered
- [x] `POST /portal/login` — autorizzazione client su Omada, upsert ospite CRM
- [x] Splash template brandizzabile: logo, hero banner, immagine di sfondo, colori, testi
- [x] Metodi di login: email + consensi GDPR, click-through
- [x] Campo telefono nel form (obbligatorio)
- [x] Ordine campi form: Nome → Email → Telefono (tutti obbligatori)
- [x] CSS splash: stile unificato per `input[type=email/text/tel]`
- [x] `POST /auth/register` e `POST /auth/login` — JWT per gestori
- [x] `GET/POST /tenants`, `GET /tenants/:id`
- [x] `GET/POST /sites`, `GET /sites/:id`, `PATCH /sites/:id`
- [x] `POST /sites/:id/upload/:field` — upload immagini (logo, hero, background) con `@fastify/multipart@8`
- [x] `GET /stats/:siteId` — KPI dashboard (connessioni oggi, ospiti totali, nuovi settimana)
- [x] `GET /crm/guests` — lista ospiti con paginazione, ricerca, conteggio sessioni, ultima visita
- [x] `GET /crm/guests/:id` — dettaglio ospite con sessioni e consensi GDPR
- [x] `@fastify/static` per servire `/public/uploads/`
- [x] Migrazioni Prisma: `init`, `add_site_branding`, `add_site_images`

#### Dashboard (React + Vite + Tailwind)

- [x] Login gestore con JWT e persistenza Zustand + localStorage
- [x] Layout con sidebar: Overview, Ospiti, Impostazioni
- [x] Pagina Overview: KPI card (connessioni oggi, ospiti totali, nuovi settimana), tabella ospiti recenti
- [x] Pagina Ospiti (`/guests`): tabella paginata con ricerca, avatar, contatore sessioni, data ultima visita
- [x] Pannello dettaglio ospite (slide-over): anagrafica, storico sessioni WiFi, consensi GDPR
- [x] Pagina Impostazioni (`/settings`) — 3 tab:
  - **Branding**: info sito, testi splash, upload immagini (logo/hero/sfondo), colori con preview live
  - **Omada**: URL controller, OmadacID, Site ID, credenziali operatore
  - **Login**: selezione metodi di accesso (email, click-through, Google, Facebook)
- [x] Componente `ImageUploader`: drag&drop, preview, cambio/rimozione, validazione MIME e dimensione

**Deliverable:** prodotto installabile in una struttura pilota. ✅

---

### Fase 2 — Survey e recensioni (4 settimane)

- [ ] Survey engine: builder questionario NPS/CSAT
- [ ] Trigger post-soggiorno (N ore dopo sessione WiFi)
- [ ] Logica "review funnel": NPS alto → invito recensione Google; NPS basso → alert gestore
- [ ] Integrazione Google Business Profile API (lettura recensioni)
- [ ] Email transazionali con SendGrid (template multilingua)
- [ ] Pagina Survey nella dashboard

**Deliverable:** ciclo completo soggiorno → survey → recensione/alert.

---

### Fase 3 — Marketing automation (4-6 settimane)

- [ ] Campaign engine: segmenti (lingua, nazionalità, data soggiorno, ritorni)
- [ ] Editor email (template predefiniti per partire)
- [ ] Canale SMS/WhatsApp via Twilio
- [ ] Automazioni: compleanno, anniversario soggiorno, pre-stagione
- [ ] Reportistica campagne (open rate, CTR, conversioni)
- [x] Export CSV lista ospiti (con BOM UTF-8 per Excel)

**Deliverable:** suite di marketing utilizzabile in autonomia dal gestore.

---

### Fase 4 — Reputation e scalabilità (4 settimane)

- [ ] Aggregatore recensioni multi-piattaforma (Google, TripAdvisor, Booking)
- [ ] Sentiment analysis sui feedback
- [ ] Widget recensioni embeddabile sul sito della struttura
- [ ] Cifratura credenziali Omada (vault/KMS)
- [ ] Hardening multi-tenant, load testing
- [ ] Billing e piani (Stripe)

**Deliverable:** prodotto commercializzabile con pricing a tier.

---

### Fase 5 — Estensioni (backlog)

- App mobile ospite (guida struttura, push geolocalizzate)
- Supporto gateway aggiuntivi (UniFi, MikroTik, Cambium) tramite adapter pattern
- Integrazione PMS (Opera, Scrigno, Slope) per dati check-in/check-out
- AI: risposta automatica alle recensioni, insight sui feedback
- Seamless re-login per MAC noti (ospiti di ritorno senza form)

---

## 5. Struttura del progetto

```
Authwifi/
├── apps/
│   ├── api/                        # NestJS + Fastify (porta 3000)
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Modelli: Tenant, Manager, Site, Guest, WifiSession, Consent
│   │   ├── src/
│   │   │   ├── main.ts             # Bootstrap, @fastify/static, @fastify/multipart
│   │   │   └── modules/
│   │   │       ├── auth/           # JWT login/register gestori
│   │   │       ├── tenant/         # Tenant, Site, Stats, Upload controllers
│   │   │       ├── portal/         # Splash, Login Omada, splash.template.ts
│   │   │       └── crm/            # Guests list + detail
│   │   └── public/uploads/         # Immagini caricate (logo, hero, background)
│   └── dashboard/                  # React + Vite + Tailwind (porta 5174)
│       └── src/
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── DashboardPage.tsx
│           │   ├── GuestsPage.tsx
│           │   └── SettingsPage.tsx
│           └── components/
│               ├── ImageUploader.tsx
│               └── GuestDetail.tsx
├── docker-compose.yml              # Postgres 9999, Redis 6379, RabbitMQ 5672/15672
├── .env                            # DATABASE_URL, JWT_SECRET, OMADA_*
└── tsconfig.base.json
```

### Variabili d'ambiente rilevanti (`.env`)

```env
DATABASE_URL="postgresql://authwifi:authwifi@localhost:9999/authwifi?schema=public"
JWT_SECRET="..."
OMADA_CONTROLLER_URL="https://192.168.x.x:8043"
OMADA_OMADAC_ID="..."          # hash 32 char dalla URL del controller
OMADA_OPERATOR_USERNAME="..."  # account Hotspot Operator (non admin)
OMADA_OPERATOR_PASSWORD="..."
```

### Comandi utili

```bash
# Avvio servizi Docker (dal root del progetto, sul server)
docker compose up -d

# Backend (dev watch)
cd apps/api
npm run start:dev

# Dashboard (dev)
cd apps/dashboard
npm run dev -- --host 0.0.0.0 --port 5174

# Migrazioni DB
cd apps/api
npx prisma migrate dev --name <nome_migrazione>
npx prisma studio          # GUI DB su porta 5555
```

> **Nota:** i comandi su PowerShell non supportano `&&`; eseguire separatamente o usare `;`.

---

## 6. Rischi principali

| Rischio | Mitigazione |
|---|---|
| Cambi API Omada tra versioni controller | Pin della versione controller supportata, test di regressione, layer di astrazione gateway |
| Captive portal detection inconsistente | Test matrix dispositivi reali in Fase 0 |
| Deliverability email scarsa | Dominio dedicato, warm-up, SPF/DKIM/DMARC fin dal giorno 1 |
| GDPR non conforme | Coinvolgere consulente privacy prima del go-live pilota |
| Dipendenza dal singolo vendor (TP-Link) | Architettura con adapter pattern per gateway futuri |

---

## 7. Metriche di successo MVP

- Tempo di onboarding nuova struttura < 1 giorno
- Tasso di completamento login portale > 85%
- Tempo caricamento splash page < 1,5 s
- Uptime servizio auth > 99,9% (un portale giù = WiFi inutilizzabile per gli ospiti)
- Prima struttura pilota attiva entro fine Fase 1
