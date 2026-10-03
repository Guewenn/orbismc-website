// Une adresse vérifiée appartient à une UUID Minecraft, jamais à un pseudo saisi au paiement.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { pool, une, requete } = require('./base');
const config = require('./config');
const courriel = require('./courriel');
const pbkdf2 = promisify(crypto.pbkdf2);
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const normaliser = email => typeof email === 'string' && email.length <= 254 && /^[\x21-\x7e]+$/.test(email.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim().toLowerCase() : null;
const jetonValide = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
const motDePasseValide = mdp => typeof mdp === 'string' && mdp.length >= 12 && mdp.length <= 64;
async function hacher(mdp) {
 if (!motDePasseValide(mdp)) throw new Error('Choisis un mot de passe de 12 à 64 caractères.');
 const sel = crypto.randomBytes(16).toString('base64');
 return { hash: (await pbkdf2(mdp, Buffer.from(sel, 'base64'), 210000, 32, 'sha256')).toString('base64'), sel, iterations: 210000 };
}
async function lire(uuid) {
 try { return await une('SELECT uuid, email, hash, sel, iterations, revision FROM identites_mail WHERE uuid = ?', [uuid]); }
 catch (e) { if (e.code === 'ER_NO_SUCH_TABLE') return null; throw e; }
}
async function parEmail(email) {
 return une('SELECT c.uuid, c.pseudo, c.hash AS hash_jeu, c.type, m.hash, m.sel, m.iterations, m.revision FROM identites_mail m JOIN comptes c ON c.uuid = m.uuid WHERE m.email = ?', [normaliser(email) || '']);
}
async function demanderLiaison(uuid, email, mdp) {
 email = normaliser(email);
 if (!email) return { erreur: 'Adresse mail invalide.' };
 if (!motDePasseValide(mdp)) return { erreur: 'Choisis un mot de passe web de 12 à 64 caractères.' };
 if (!courriel.securiteDisponible()) return { erreur: 'La vérification par mail sera disponible lorsque le service de messagerie sera configuré.' };
 const ancien = await lire(uuid);
 if (ancien) return { erreur: 'Une adresse est déjà reliée. Utilise la récupération du mot de passe ou contacte le support pour changer d’adresse.' };
 const secret = await hacher(mdp), token = crypto.randomBytes(32).toString('base64url');
 await requete('DELETE FROM demandes_mail WHERE expire < ?', [Date.now()]);
 await requete('INSERT INTO demandes_mail (uuid, objectif, jeton, email, hash, sel, iterations, expire) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE jeton=VALUES(jeton), email=VALUES(email), hash=VALUES(hash), sel=VALUES(sel), iterations=VALUES(iterations), expire=VALUES(expire)', [uuid, 'lier', digest(token), email, secret.hash, secret.sel, secret.iterations, Date.now() + 30 * 60000]);
 try {
  await courriel.envoyerSecurite({ email, sujet: 'Confirme ton adresse OrbisMC', texte: `Tu as demandé à relier cette adresse à ton compte Minecraft. Connecte-toi au même compte sur le site, puis confirme sous 30 minutes :\n${config.urlPublique}/compte/mail/confirmer?jeton=${token}\nSi tu n’es pas à l’origine de cette demande, ignore ce message.` });
  return { message: 'Un lien valable 30 minutes a été envoyé. Ouvre-le en restant connecté au même compte Minecraft.' };
 } catch {
  await requete('DELETE FROM demandes_mail WHERE jeton = ?', [digest(token)]);
  return { erreur: 'Le mail n’a pas pu être envoyé. Réessaie plus tard.' };
 }
}
async function recuperer(email) {
 const message = 'Si cette adresse est reliée à un compte, un lien de récupération valable 20 minutes sera envoyé.';
 email = normaliser(email);
 if (!email || !courriel.securiteDisponible()) return { message };
 const compte = await une('SELECT uuid FROM identites_mail WHERE email = ?', [email]);
 if (!compte) return { message };
 const token = crypto.randomBytes(32).toString('base64url');
 await requete('DELETE FROM demandes_mail WHERE expire < ?', [Date.now()]);
 await requete("INSERT INTO demandes_mail (uuid, objectif, jeton, email, hash, sel, iterations, expire) VALUES (?, 'recuperer', ?, ?, '', '', 0, ?) ON DUPLICATE KEY UPDATE jeton=VALUES(jeton), email=VALUES(email), expire=VALUES(expire)", [compte.uuid, digest(token), email, Date.now() + 20 * 60000]);
 try { await courriel.envoyerSecurite({ email, sujet: 'Réinitialise ton mot de passe web OrbisMC', texte: `Choisis un nouveau mot de passe sous 20 minutes :\n${config.urlPublique}/connexion/recuperer?jeton=${token}\nCela déconnectera les sessions web existantes. Ton mot de passe Minecraft reste inchangé. Si tu n’as rien demandé, ignore ce message.` }); }
 catch { await requete('DELETE FROM demandes_mail WHERE jeton = ?', [digest(token)]); }
 return { message };
}
async function confirmer(token, uuid, mdp) {
 if (!jetonValide(token)) return { erreur: 'Lien invalide ou expiré.' };
 const secret = mdp !== undefined ? await hacher(mdp) : null;
 const c = await pool.getConnection();
 try {
  await c.beginTransaction();
  // Verrou du compte avant la demande, comme la suppression du compte côté serveur.
  const [cibles] = await c.execute('SELECT uuid FROM demandes_mail WHERE jeton=?', [digest(token)]);
  if (!cibles[0]) { await c.rollback(); return { erreur: 'Lien invalide ou expiré.' }; }
  const [comptes] = await c.execute('SELECT uuid FROM comptes WHERE uuid=? FOR UPDATE', [cibles[0].uuid]);
  if (!comptes.length) { await c.rollback(); return { erreur: 'Lien invalide ou expiré.' }; }
  // Deux validations simultanées ne gagnent jamais.
  const [demandes] = await c.execute('SELECT * FROM demandes_mail WHERE jeton = ? FOR UPDATE', [digest(token)]);
  const d = demandes[0];
  if (!d || Number(d.expire) < Date.now() || (d.objectif === 'lier' ? d.uuid !== uuid || secret : !secret)) { await c.rollback(); return { erreur: 'Lien invalide ou expiré.' }; }
  if (d.objectif === 'lier') {
   await c.execute('INSERT INTO identites_mail (uuid, email, hash, sel, iterations, revision, verifie) VALUES (?, ?, ?, ?, ?, 1, ?)', [d.uuid, d.email, d.hash, d.sel, d.iterations, Date.now()]);
  } else {
   const [r] = await c.execute('UPDATE identites_mail SET hash=?, sel=?, iterations=?, revision=revision+1 WHERE uuid=? AND email=?', [secret.hash, secret.sel, secret.iterations, d.uuid, d.email]);
   if (r.affectedRows !== 1) { await c.rollback(); return { erreur: 'Lien invalide ou expiré.' }; }
  }
  await c.execute('DELETE FROM demandes_mail WHERE uuid=?', [d.uuid]);
  await c.commit();
  return { message: d.objectif === 'lier' ? 'Adresse vérifiée ! Connecte-toi désormais avec ton mail et ton mot de passe web.' : 'Mot de passe web modifié. Les anciennes sessions sont déconnectées.' };
 } catch (e) {
  await c.rollback();
  if (e.code === 'ER_DUP_ENTRY') return { erreur: 'Cette adresse ou ce compte est déjà relié. Aucun changement effectué.' };
  throw e;
 } finally { c.release(); }
}
module.exports = { lire, parEmail, demanderLiaison, recuperer, confirmer, normaliser, jetonValide, motDePasseValide };
