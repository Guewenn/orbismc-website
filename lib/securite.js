// Protections transverses du site : en-têtes de sécurité, origine des formulaires, méthodes autorisées,
// limitation du débit par IP. Les protections propres aux données sont ailleurs : requêtes SQL toujours
// paramétrées (lib/base.js), échappement HTML (lib/html.js), jeton CSRF et cookie signé (lib/session.js).
const config = require('./config');

const ORIGINE_PUBLIQUE = (() => {
  try {
    return new URL(config.urlPublique).origin;
  } catch {
    return '';
  }
})();

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  // Le seul formulaire qui sort du site est le paiement Tebex (redirection vers leur page).
  "form-action 'self' https://*.tebex.io",
  // Le JavaScript du site n'écrit jamais de HTML : toute injection DOM par chaîne est refusée par le navigateur.
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
];

function estHttps(req) {
  return req.secure;
}

function entetes(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP.join('; ') + (estHttps(req) ? '; upgrade-insecure-requests' : ''),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Origin-Agent-Cluster': '?1',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    // L'ancien filtre XSS des navigateurs créait lui-même des failles : on le coupe, la CSP le remplace.
    'X-XSS-Protection': '0',
    'Permissions-Policy': 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), '
      + 'geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), '
      + 'publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=(), browsing-topics=()',
  });
  // Les illustrations SVG du site animent leurs étoiles avec un <style> interne : autorisé pour elles seules,
  // sans aucun script ni chargement externe.
  if (req.path.endsWith('.svg')) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  if (estHttps(req)) res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
}

// Seules GET, HEAD et POST existent sur ce site.
function methodes(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'POST') return next();
  res.set('Allow', 'GET, HEAD, POST').status(405).type('text/plain').send('Méthode non autorisée.');
}

// Un formulaire doit venir du site lui-même (en plus du jeton CSRF) : en-têtes Fetch Metadata et Origin.
function origineSure(req, res, next) {
  if (req.method !== 'POST') return next();
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return refuser(res);
  const origine = req.get('origin');
  if (origine && origine !== 'null') {
    const locale = `${req.protocol}://${req.get('host')}`;
    if (origine !== locale && origine !== ORIGINE_PUBLIQUE) return refuser(res);
  } else if (origine === 'null') {
    return refuser(res);
  }
  next();
}

function refuser(res) {
  res.status(403).type('text/plain').send('Requête refusée : elle ne vient pas du site.');
}

// Au plus `max` essais par clé (IP, pseudo…) sur `fenetreMs` (en mémoire : suffisant pour un seul serveur web).
function limiteur(max, fenetreMs) {
  const essais = new Map();
  setInterval(() => {
    const maintenant = Date.now();
    for (const [cle, e] of essais) if (maintenant - e.debut > fenetreMs) essais.delete(cle);
  }, fenetreMs).unref();
  return {
    bloque(cle) {
      const e = essais.get(cle);
      return !!e && Date.now() - e.debut < fenetreMs && e.n >= max;
    },
    echec(cle) {
      const e = essais.get(cle);
      if (!e || Date.now() - e.debut > fenetreMs) essais.set(cle, { n: 1, debut: Date.now() });
      else e.n++;
    },
    reussite(cle) {
      essais.delete(cle);
    },
  };
}

// Limite de débit par IP pour toutes les requêtes (anti-inondation), plus stricte sur les formulaires.
function debit({ max, maxPost, fenetreMs }) {
  const pages = limiteur(max, fenetreMs);
  const envois = limiteur(maxPost, fenetreMs);
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '?';
    const compteur = req.method === 'POST' ? envois : pages;
    compteur.echec(ip);
    if (compteur.bloque(ip)) {
      res.set('Retry-After', String(Math.ceil(fenetreMs / 1000))).status(429).type('text/plain').send('Trop de requêtes : patiente une minute.');
      return;
    }
    next();
  };
}

// Un lien externe venant de la configuration n'est accepté qu'en https (jamais javascript: ou data:).
function lienSur(url) {
  return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
}

module.exports = { entetes, methodes, origineSure, limiteur, debit, lienSur, ORIGINE_PUBLIQUE };
