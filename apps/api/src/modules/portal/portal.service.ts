import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OmadaClient } from './omada.client';
import { CrmService } from '../crm/crm.service';

export interface OmadaRedirectParams {
  clientMac: string;
  apMac: string;
  ssidName: string;
  radioId?: string;
  site: string;          // Omada site identifier
  redirectUrl: string;   // URL originale dell'ospite
}

export interface GuestLoginDto {
  siteId: string;        // ID del nostro Site in DB
  clientMac: string;
  apMac: string;
  ssidName: string;
  radioId?: string;
  omadaSiteId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  language?: string;
  consents: string[];    // array di ConsentType concessi
}

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    private prisma: PrismaService,
    private omada: OmadaClient,
    private crm: CrmService,
  ) {}

  /**
   * Restituisce i dati del sito necessari per renderizzare la splash page
   * (logo, colori, testi, metodi di login abilitati).
   */
  async getSplashData(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { tenant: true },
    });
    if (!site) throw new BadRequestException('Sito non trovato');

    return {
      siteName: site.name,
      tenantName: site.tenant.name,
      logoUrl: site.logoUrl ?? site.tenant.logoUrl,
      backgroundImageUrl: site.backgroundImageUrl,
      heroImageUrl: site.heroImageUrl,
      primaryColor: site.primaryColor,
      accentColor: site.accentColor,
      welcomeTitle: site.welcomeTitle,
      welcomeText: site.welcomeText,
      loginMethods: site.loginMethods.split(',').map((m) => m.trim()),
    };
  }

  /**
   * Gestisce il submit del form di login dal captive portal:
   * 1. Upsert profilo ospite nel CRM
   * 2. Salva consensi GDPR
   * 3. Apre sessione WiFi nel DB
   * 4. Chiama Omada API per autorizzare il client
   */
  async guestLogin(dto: GuestLoginDto): Promise<{ redirectUrl: string }> {
    // 1. Recupera configurazione sito
    const site = await this.prisma.site.findUnique({ where: { id: dto.siteId } });
    if (!site) throw new BadRequestException('Sito non trovato');

    if (!site.omadaControllerUrl || !site.omadaOmadacId || !site.omadaSiteId) {
      throw new BadRequestException('Configurazione Omada incompleta per questo sito');
    }

    // 2. Upsert ospite nel CRM
    const guest = await this.crm.upsertGuest({
      tenantId: site.tenantId,
      mac: dto.clientMac,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      language: dto.language,
    });

    // 3. Salva consensi
    if (dto.consents.length > 0) {
      await this.prisma.consent.createMany({
        data: dto.consents.map((type) => ({
          guestId: guest.id,
          type: type as any,
          granted: true,
          policyVersion: '1.0',
        })),
        skipDuplicates: true,
      });
    }

    // 4. Crea sessione WiFi
    const session = await this.prisma.wifiSession.create({
      data: {
        guestId: guest.id,
        siteId: site.id,
        macAddress: dto.clientMac,
        apMac: dto.apMac,
        ssidName: dto.ssidName,
      },
    });

    // 5. Autorizza il client su Omada
    try {
      await this.omada.authorizeClient(
        {
          controllerUrl: site.omadaControllerUrl,
          omadacId: site.omadaOmadacId,
          siteId: site.omadaSiteId,
          operatorUser: site.omadaOperatorUser!,
          operatorPass: site.omadaOperatorPass!,
        },
        {
          clientMac: dto.clientMac,
          apMac: dto.apMac,
          ssidName: dto.ssidName,
          radioId: dto.radioId,
        },
      );
    } catch (err) {
      this.logger.error(`Omada auth error per session ${session.id}: ${err}`);
      // Non bloccare il flusso in Fase 0 — loggare e proseguire
    }

    return { redirectUrl: '/portal/welcome' };
  }
}
