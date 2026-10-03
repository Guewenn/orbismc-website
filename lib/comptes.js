// Connexion au site avec le compte du serveur : même mot de passe qu'en jeu (hachage PBKDF2-SHA256
// identique à celui du plugin), ou code à usage unique obtenu en jeu avec /site.
const crypto = require('crypto');
const { promisify } = require('util');
const { une, requete } = require('./base');
const { empreinte } = require('./session');
const identiteMail = require('./identite-mail');
const versionWeb = compte => compte ? empreinte({ uuid: compte.uuid, type: `mail:${compte.revision}`, hash: compte.hash }) : '';

const pbkdf2 = promisify(crypto.pbkdf2);
const ITERATIONS_MAX = 2_000_000;
// Sel factice : un pseudo inconnu coûte le même calcul qu'un vrai, le temps de réponse ne trahit rien.
const SEL_FACTICE = crypto.randomBytes(16);

// Calcul asynchrone : le hachage ne bloque jamais le serveur pendant qu'il répond aux autres visiteurs.
async function verifierMotDePasse(motDePasse, compte) {
  const valide = compte && compte.hash && compte.sel && Number(compte.iterations) > 0 && Number(compte.iterations) <= ITERATIONS_MAX;
  const sel = valide ? Buffer.from(compte.sel, 'base64') : SEL_FACTICE;
  const iterations = valide ? Number(compte.iterations) : 120000;
  const calcule = await pbkdf2(motDePasse, sel, iterations, 32, 'sha256');
  if (!valide) return false;
  const attendu = Buffer.from(compte.hash, 'base64');
  return attendu.length === calcule.length && crypto.timingSafeEqual(attendu, calcule);
}

async function parMotDePasse(pseudo, motDePasse) {
  const INCORRECT = { erreur: 'Pseudo ou mot de passe incorrect.' };
  if (typeof pseudo === 'string' && pseudo.includes('@')) {
    if (typeof motDePasse !== 'string' || !motDePasse || motDePasse.length > 64) return INCORRECT;
    const m = await identiteMail.parEmail(pseudo);
    if (!(await verifierMotDePasse(motDePasse, m))) return { erreur: 'Adresse mail ou mot de passe incorrect.' };
    return { joueur: { uuid: m.uuid, pseudo: m.pseudo, emp: empreinte({ ...m, hash: m.hash_jeu }), web: versionWeb(m) } };
  }
  if (typeof pseudo !== 'string' || typeof motDePasse !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(pseudo) || !motDePasse || motDePasse.length > 64) return INCORRECT;
  const compte = await une('SELECT pseudo, uuid, hash, sel, iterations, type FROM comptes WHERE pseudo_min = ?', [pseudo.toLowerCase()]);
  if (!compte) {
    await verifierMotDePasse(motDePasse, null);
    return INCORRECT;
  }
  if (!compte.hash || !compte.sel) {
    return { erreur: 'Aucun mot de passe n\'est encore défini pour ce compte : tape /site en jeu pour te connecter.' };
  }
  const bon = await verifierMotDePasse(motDePasse, compte);
  if (!bon) return INCORRECT;
  return { joueur: { uuid: compte.uuid, pseudo: compte.pseudo, emp: empreinte(compte), web: versionWeb(await identiteMail.lire(compte.uuid)) } };
}

async function parCode(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) return { erreur: 'Code invalide.' };
  const ligne = await une('SELECT uuid, pseudo, expire FROM codes_web WHERE code = ?', [code]);
  if (!ligne || ligne.expire < Date.now()) return { erreur: 'Code invalide ou expiré : tape /site en jeu pour en recevoir un nouveau.' };
  // Usage unique : seule la requête qui supprime vraiment le code gagne (deux clics simultanés = une connexion).
  const resultat = await requete('DELETE FROM codes_web WHERE code = ?', [code]);
  if (resultat.affectedRows !== 1) return { erreur: 'Code déjà utilisé.' };
  const compte = await une('SELECT uuid, hash, type FROM comptes WHERE uuid = ?', [ligne.uuid]);
  if (!compte) return { erreur: 'Compte introuvable.' };
  return { joueur: { uuid: ligne.uuid, pseudo: ligne.pseudo, emp: empreinte(compte), web: versionWeb(await identiteMail.lire(compte.uuid)) } };
}

// La session est-elle toujours valable ? (compte supprimé, mot de passe changé, passé en premium…)
async function sessionValide(session) {
  if (!session || typeof session.uuid !== 'string' || !/^[0-9a-f-]{36}$/i.test(session.uuid)) return false;
  const compte = await une('SELECT uuid, hash, type FROM comptes WHERE uuid = ?', [session.uuid]);
  return !!compte && typeof session.emp === 'string' && session.emp === empreinte(compte)
    && (session.web || '') === versionWeb(await identiteMail.lire(session.uuid));
}

async function destinataire(uuid) {
  const compte = await une('SELECT pseudo FROM comptes WHERE uuid = ?', [uuid]);
  return compte && /^[A-Za-z0-9_]{3,16}$/.test(compte.pseudo) ? compte.pseudo : null;
}

module.exports = { parMotDePasse, parCode, sessionValide, destinataire };
