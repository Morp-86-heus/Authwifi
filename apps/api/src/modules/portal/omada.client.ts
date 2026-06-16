/**
 * OmadaClient — wrapper per le API Omada External Portal.
 *
 * Documentazione di riferimento:
 *   TP-Link Omada SDN Controller API Documentation
 *   Endpoints utilizzati:
 *     POST /api/v2/hotspot/login           → ottieni token sessione operator
 *     POST /api/v2/hotspot/extPortal/auth  → autorizza il client WiFi
 *
 * ATTENZIONE: il controller usa HTTPS con certificato self-signed in molte
 * installazioni on-prem. In sviluppo si disabilita la verifica (NODE_TLS_REJECT_UNAUTHORIZED=0).
 * In produzione usare il certificato reale o importare la CA del controller.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface OmadaSession {
  csrfToken: string;
  cookie: string;
  expiresAt: number;
}

@Injectable()
export class OmadaClient {
  private readonly logger = new Logger(OmadaClient.name);
  private sessionCache = new Map<string, OmadaSession>();

  constructor(
    private http: HttpService,
    private config: ConfigService,
  ) {}

  /**
   * Effettua il login come Hotspot Operator e restituisce il token di sessione.
   * Il token viene cachato per 8 ore (durata tipica sessione Omada).
   */
  async getSession(
    controllerUrl: string,
    omadacId: string,
    username: string,
    password: string,
  ): Promise<OmadaSession> {
    const cacheKey = `${controllerUrl}::${username}`;
    const cached = this.sessionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const loginUrl = `${controllerUrl}/${omadacId}/api/v2/hotspot/login`;
    this.logger.log(`OmadaClient: login operator → ${loginUrl}`);

    const response = await firstValueFrom(
      this.http.post<{ errorCode: number; result?: { token?: string } }>(
        loginUrl,
        { name: username, password },
        {
          httpsAgent: this.buildHttpsAgent(),
          withCredentials: true,
        },
      ),
    );

    const data = response.data;
    if (data.errorCode !== 0) {
      throw new Error(`Omada login failed: ${JSON.stringify(data)}`);
    }

    // Il controller restituisce il token CSRF nel body e il session cookie nell'header
    const setCookie: string[] = (response.headers['set-cookie'] as string[]) ?? [];
    const cookieStr = setCookie.map((c) => c.split(';')[0]).join('; ');

    const session: OmadaSession = {
      csrfToken: data.result?.token ?? '',
      cookie: cookieStr,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8h
    };

    this.sessionCache.set(cacheKey, session);
    return session;
  }

  /**
   * Autorizza un client WiFi tramite l'API extPortal.
   *
   * @param siteConfig  Configurazione del sito (controller URL, credenziali)
   * @param authParams  Parametri ricevuti in query string dal redirect Omada
   * @param durationMs  Durata della sessione WiFi in ms (default 8h)
   */
  async authorizeClient(
    siteConfig: {
      controllerUrl: string;
      omadacId: string;
      siteId: string;
      operatorUser: string;
      operatorPass: string;
    },
    authParams: {
      clientMac: string;
      apMac: string;
      ssidName: string;
      radioId?: string;
    },
    durationMs = 8 * 60 * 60 * 1000,
  ): Promise<void> {
    const { controllerUrl, omadacId, siteId, operatorUser, operatorPass } =
      siteConfig;

    const session = await this.getSession(
      controllerUrl,
      omadacId,
      operatorUser,
      operatorPass,
    );

    const authUrl = `${controllerUrl}/${omadacId}/api/v2/hotspot/extPortal/auth`;
    this.logger.log(
      `OmadaClient: authorize client ${authParams.clientMac} on site ${siteId}`,
    );

    const payload = {
      clientMac: authParams.clientMac,
      apMac: authParams.apMac,
      ssidName: authParams.ssidName,
      radioId: authParams.radioId ?? '0',
      site: siteId,
      time: durationMs,
      authType: 4, // External Portal
    };

    const response = await firstValueFrom(
      this.http.post<{ errorCode: number }>(authUrl, payload, {
        httpsAgent: this.buildHttpsAgent(),
        headers: {
          'Csrf-Token': session.csrfToken,
          Cookie: session.cookie,
        },
      }),
    );

    const data = response.data;
    if (data.errorCode !== 0) {
      throw new Error(`Omada auth failed: ${JSON.stringify(data)}`);
    }

    this.logger.log(
      `OmadaClient: client ${authParams.clientMac} authorized ✓`,
    );
  }

  private buildHttpsAgent() {
    // In sviluppo accettiamo certificati self-signed
    if (this.config.get('NODE_ENV') !== 'production') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require('https');
      return new https.Agent({ rejectUnauthorized: false });
    }
    return undefined;
  }
}
