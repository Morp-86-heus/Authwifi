export interface SplashTemplateData {
  // Branding
  siteName: string;
  tenantName: string;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  heroImageUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  welcomeTitle: string;
  welcomeText: string;
  loginMethods: string[]; // ['email', 'clickthrough', 'google', 'facebook']

  // Omada params (passati come hidden fields)
  siteId: string;
  clientMac: string;
  apMac: string;
  ssidName: string;
  radioId: string;
  omadaSiteId: string;
  redirectUrl: string;
}

export function renderSplash(d: SplashTemplateData): string {
  const hasEmail = d.loginMethods.includes('email');
  const hasClickthrough = d.loginMethods.includes('clickthrough');
  const hasGoogle = d.loginMethods.includes('google');
  const hasFacebook = d.loginMethods.includes('facebook');

  const hiddenFields = `
    <input type="hidden" name="siteId"      value="${esc(d.siteId)}"/>
    <input type="hidden" name="clientMac"   value="${esc(d.clientMac)}"/>
    <input type="hidden" name="apMac"       value="${esc(d.apMac)}"/>
    <input type="hidden" name="ssidName"    value="${esc(d.ssidName)}"/>
    <input type="hidden" name="radioId"     value="${esc(d.radioId)}"/>
    <input type="hidden" name="omadaSiteId" value="${esc(d.omadaSiteId)}"/>
  `;

  const emailForm = hasEmail ? `
    <form id="form-email" method="POST" action="/portal/login">
      ${hiddenFields}
      <input type="hidden" name="loginMethod" value="email"/>
      <div class="field">
        <input type="text" name="firstName" placeholder="Nome *" required autocomplete="given-name"/>
      </div>
      <div class="field">
        <input type="email" name="email" placeholder="Email *" required autocomplete="email"/>
      </div>
      <div class="field">
        <input type="tel" name="phone" placeholder="Telefono *" required autocomplete="tel"/>
      </div>
      <div class="consents">
        <label class="consent-row">
          <input type="checkbox" name="consents" value="TERMS_OF_SERVICE" required/>
          <span>Accetto i <a href="/legal/terms" target="_blank">Termini di servizio</a> *</span>
        </label>
        <label class="consent-row">
          <input type="checkbox" name="consents" value="MARKETING_EMAIL"/>
          <span>Desidero ricevere offerte e novità via email</span>
        </label>
      </div>
      <button type="submit" class="btn-primary">
        Connettiti con email →
      </button>
    </form>
  ` : '';

  const clickthroughForm = hasClickthrough ? `
    <form id="form-clickthrough" method="POST" action="/portal/login">
      ${hiddenFields}
      <input type="hidden" name="loginMethod" value="clickthrough"/>
      <input type="hidden" name="consents"    value="TERMS_OF_SERVICE"/>
      <p class="terms-note">
        Cliccando accetti i <a href="/legal/terms" target="_blank">Termini di servizio</a>.
      </p>
      <button type="submit" class="btn-secondary">
        Accedi senza registrazione
      </button>
    </form>
  ` : '';

  const socialButtons = (hasGoogle || hasFacebook) ? `
    <div class="social-section">
      <div class="divider"><span>oppure</span></div>
      ${hasGoogle ? `
      <a href="/portal/social/google?siteId=${esc(d.siteId)}&clientMac=${esc(d.clientMac)}&apMac=${esc(d.apMac)}&ssidName=${esc(d.ssidName)}&radioId=${esc(d.radioId)}&omadaSiteId=${esc(d.omadaSiteId)}" class="btn-social btn-google">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.7 5.4 2.9 13.3l7.8 6C12.5 13 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4C43.1 36.8 46.1 31 46.1 24.5z"/><path fill="#FBBC05" d="M10.7 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.4-4.6 2.2-8.2 2.2-6.2 0-11.5-4.2-13.4-9.8l-8.2 6.1C6.6 42.6 14.7 48 24 48z"/></svg>
        Continua con Google
      </a>` : ''}
      ${hasFacebook ? `
      <a href="/portal/social/facebook?siteId=${esc(d.siteId)}&clientMac=${esc(d.clientMac)}&apMac=${esc(d.apMac)}&ssidName=${esc(d.ssidName)}&radioId=${esc(d.radioId)}&omadaSiteId=${esc(d.omadaSiteId)}" class="btn-social btn-facebook">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
        Continua con Facebook
      </a>` : ''}
    </div>
  ` : '';

  const separator = hasEmail && hasClickthrough ? `
    <div class="divider"><span>oppure</span></div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="robots" content="noindex"/>
  <title>WiFi ${esc(d.siteName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ${d.backgroundImageUrl
        ? `background: url('${esc(d.backgroundImageUrl)}') center/cover no-repeat fixed; background-color: ${esc(d.accentColor)};`
        : `background: ${esc(d.accentColor)};`}
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    ${d.backgroundImageUrl ? `
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.35);
      z-index: 0;
    }` : ''}

    .card {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      position: relative;
      z-index: 1;
    }

    .card-body {
      padding: 32px 32px 36px;
    }

    .hero-img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      display: block;
    }

    .logo-wrap {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-wrap img {
      max-height: 64px;
      max-width: 180px;
      object-fit: contain;
    }

    .welcome-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #111;
      text-align: center;
      margin-bottom: 6px;
    }
    .welcome-text {
      font-size: .92rem;
      color: #555;
      text-align: center;
      margin-bottom: 24px;
      line-height: 1.5;
    }

    .field { margin-bottom: 12px; }
    .field input[type="email"],
    .field input[type="text"],
    .field input[type="tel"] {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #ddd;
      border-radius: 10px;
      font-size: .95rem;
      outline: none;
      transition: border-color .2s;
    }
    .field input[type="email"]:focus,
    .field input[type="text"]:focus,
    .field input[type="tel"]:focus { border-color: ${esc(d.primaryColor)}; }

    .consents { margin: 14px 0 18px; }
    .consent-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .consent-row input[type="checkbox"] {
      margin-top: 2px;
      accent-color: ${esc(d.primaryColor)};
      flex-shrink: 0;
    }
    .consent-row span {
      font-size: .83rem;
      color: #444;
      line-height: 1.4;
    }
    .consent-row a { color: ${esc(d.primaryColor)}; text-decoration: none; }
    .consent-row a:hover { text-decoration: underline; }

    .btn-primary {
      width: 100%;
      padding: 13px;
      background: ${esc(d.primaryColor)};
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .2s;
    }
    .btn-primary:hover { opacity: .88; }

    .btn-secondary {
      width: 100%;
      padding: 11px;
      background: transparent;
      color: ${esc(d.primaryColor)};
      border: 1.5px solid ${esc(d.primaryColor)};
      border-radius: 10px;
      font-size: .95rem;
      font-weight: 500;
      cursor: pointer;
      transition: background .2s;
      text-align: center;
    }
    .btn-secondary:hover { background: ${esc(d.primaryColor)}18; }

    .terms-note {
      font-size: .82rem;
      color: #666;
      text-align: center;
      margin-bottom: 12px;
    }
    .terms-note a { color: ${esc(d.primaryColor)}; text-decoration: none; }

    .divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 18px 0;
      color: #bbb;
      font-size: .82rem;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e5e5;
    }

    .social-section { margin-top: 4px; }
    .btn-social {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 11px;
      border-radius: 10px;
      font-size: .95rem;
      font-weight: 500;
      text-decoration: none;
      margin-bottom: 10px;
      transition: opacity .2s;
    }
    .btn-social:hover { opacity: .88; }
    .btn-google  { background: #fff; border: 1.5px solid #ddd; color: #333; }
    .btn-facebook { background: #1877f2; color: #fff; border: none; }

    .powered-by {
      text-align: center;
      margin-top: 24px;
      font-size: .75rem;
      color: #ccc;
    }
  </style>
</head>
<body>
  <div class="card">
    ${d.heroImageUrl ? `<img src="${esc(d.heroImageUrl)}" class="hero-img" alt=""/>` : ''}
    <div class="card-body">
      ${d.logoUrl ? `<div class="logo-wrap"><img src="${esc(d.logoUrl)}" alt="${esc(d.tenantName)} logo"/></div>` : ''}

      <h1 class="welcome-title">${esc(d.welcomeTitle)}</h1>
      <p class="welcome-text">${esc(d.welcomeText)}</p>

      ${emailForm}
      ${separator}
      ${clickthroughForm}
      ${socialButtons}

      <p class="powered-by">WiFi powered by Authwifi</p>
    </div>
  </div>
</body>
</html>`;
}

/** Escaping minimale per HTML attributes e text nodes */
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
