// Sessions sans stockage : un cookie signé (HMAC-SHA256) qui contient seulement l'uuid, le pseudo, une empreinte du
// compte, une date d'expiration et un jeton anti-CSRF. Impossible à modifier sans le secret du site.
// L'empreinte change si le mot de passe du compte change : toutes les sessions ouvertes avant tombent.
const crypto = require('crypto');
const config = require('./config');

const NOM = 'orbis_session';
const NOM_HTTPS = '__Host-orbis_session';
const DUREE_MS = 7 * 24 * 3600 * 1000;

if (!config.secret || config.secret.length < 32 || /A_REMPLIR/.test(config.secret)) {
  throw new Error('site/config.json : « secret » doit contenir au moins 32 caractères aléatoires.');
}

function signer(texte) {
  return crypto.createHmac('sha256', config.secret).update(texte).digest('base64url');
}

function egal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function encoder(donnees) {
  const corps = Buffer.from(JSON.stringify(donnees)).toString('base64url');
  return `${corps}.${signer(corps)}`;
}

function decoder(valeur) {
  if (typeof valeur !== 'string' || valeur.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(valeur)) return null;
  const [corps, signature] = valeur.split('.');
  if (!egal(signature, signer(corps))) return null;
  try {
    const d = JSON.parse(Buffer.from(corps, 'base64url').toString());
    if (!d || typeof d !== 'object' || !d.exp || d.exp < Date.now() || typeof d.csrf !== 'string') return null;
    return d;
  } catch {
    return null;
  }
}

function lireCookies(req) {
  const cookies = {};
  for (const morceau of (req.headers.cookie || '').split(';')) {
    const i = morceau.indexOf('=');
    if (i <= 0) continue;
    try {
      cookies[morceau.slice(0, i).trim()] = decodeURIComponent(morceau.slice(i + 1).trim());
    } catch {
      // Cookie mal encodé : ignoré.
    }
  }
  return cookies;
}

function securise(req) {
  return req.secure;
}

// En https, le préfixe __Host- interdit qu'un sous-domaine ou une page http pose ou écrase le cookie.
function nomCookie(req) {
  return securise(req) ? NOM_HTTPS : NOM;
}

function poser(req, res, valeur, maxAge) {
  res.append('Set-Cookie', `${nomCookie(req)}=${valeur}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${securise(req) ? '; Secure' : ''}`);
}

// Empreinte du compte : dérivée (HMAC) de son mot de passe haché et de son type, jamais le hachage lui-même.
function empreinte(compte) {
  const base = compte ? `${compte.uuid}|${compte.type || ''}|${compte.hash || ''}` : 'sans-compte';
  return signer(`empreinte|${base}`).slice(0, 22);
}

// Middleware : req.session (joueur connecté ou null) et req.csrf (toujours présent).
function middleware(req, res, next) {
  let session = decoder(lireCookies(req)[nomCookie(req)]);
  if (!session) {
    // Visiteur : session anonyme, uniquement pour porter le jeton anti-CSRF des formulaires.
    session = { csrf: crypto.randomBytes(24).toString('base64url'), exp: Date.now() + DUREE_MS };
    poser(req, res, encoder(session), DUREE_MS);
  }
  req.session = session.uuid ? session : null;
  req.csrf = session.csrf;
  res.locals.session = req.session;
  res.locals.csrf = req.csrf;
  next();
}

// Connexion : nouvelle session et nouveau jeton CSRF (aucune fixation de session possible).
function connecter(req, res, joueur) {
  const session = { uuid: joueur.uuid, pseudo: joueur.pseudo, emp: joueur.emp, csrf: crypto.randomBytes(24).toString('base64url'), exp: Date.now() + DUREE_MS };
  poser(req, res, encoder(session), DUREE_MS);
}

function deconnecter(req, res) {
  poser(req, res, '', 0);
}

// À mettre sur chaque POST : le jeton du formulaire doit correspondre à celui du cookie signé.
function verifierCsrf(req, res, next) {
  const jeton = req.body && req.body._csrf;
  if (typeof jeton !== 'string' || !req.csrf || !egal(jeton, req.csrf)) {
    return res.status(403).type('text/plain').send('Formulaire expiré : recharge la page et réessaie.');
  }
  next();
}

module.exports = { middleware, connecter, deconnecter, verifierCsrf, empreinte };
