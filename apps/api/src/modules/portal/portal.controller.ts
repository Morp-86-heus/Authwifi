import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { PortalService } from './portal.service';
import { OmadaClient } from './omada.client';
import { GuestLoginDto } from './dto/guest-login.dto';
import { ConfigService } from '@nestjs/config';
import { renderSplash } from './splash.template';

/**
 * PortalController — endpoint del captive portal.
 *
 * Flusso:
 *   GET  /portal/splash?siteId=...&clientMac=...&apMac=...&...
 *     → renderizza (o reindirizza verso) la splash page
 *   POST /portal/login
 *     → processa il form, autorizza su Omada, redirect post-login
 *   GET  /portal/welcome
 *     → pagina di conferma connessione riuscita
 */
@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly omadaClient: OmadaClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * TEST ONLY — verifica login sul controller Omada con le credenziali del .env.
   * Da rimuovere prima del go-live.
   */
  @Get('test-omada')
  @ApiOperation({ summary: '[DEV] Testa il login sul controller Omada' })
  async testOmada() {
    const controllerUrl = this.config.get<string>('OMADA_CONTROLLER_URL')!;
    const omadacId = this.config.get<string>('OMADA_OMADAC_ID')!;
    const username = this.config.get<string>('OMADA_OPERATOR_USERNAME')!;
    const password = this.config.get<string>('OMADA_OPERATOR_PASSWORD')!;

    try {
      const session = await this.omadaClient.getSession(
        controllerUrl,
        omadacId,
        username,
        password,
      );
      return {
        success: true,
        csrfToken: session.csrfToken,
        cookiePreview: session.cookie.substring(0, 40) + '...',
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Endpoint chiamato dal redirect del controller Omada.
   * Parametri standard Omada in query string.
   */
  @Get('splash')
  @ApiOperation({ summary: 'Punto di ingresso redirect Omada → splash page' })
  async splash(
    @Query('siteId') siteId: string,
    @Query('clientMac') clientMac: string,
    @Query('apMac') apMac: string,
    @Query('ssidName') ssidName: string,
    @Query('radioId') radioId: string,
    @Query('site') omadaSiteId: string,
    @Query('redirectUrl') redirectUrl: string,
    @Res() reply: FastifyReply,
  ) {
    const splashData = await this.portalService.getSplashData(siteId);

    const html = renderSplash({
      ...splashData,
      siteId,
      clientMac,
      apMac,
      ssidName,
      radioId: radioId ?? '0',
      omadaSiteId,
      redirectUrl,
    });

    reply.type('text/html').send(html);
  }

  @Post('login')
  @ApiOperation({ summary: 'Submit form guest login — autorizza su Omada' })
  async login(@Body() dto: GuestLoginDto) {
    return this.portalService.guestLogin(dto);
  }

  @Get('welcome')
  @ApiOperation({ summary: 'Pagina post-login' })
  async welcome(@Res() reply: FastifyReply) {
    reply.type('text/html').send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h1>✅ Connesso!</h1>
        <p>Benvenuto. Ora puoi navigare liberamente.</p>
      </body></html>
    `);
  }
}
