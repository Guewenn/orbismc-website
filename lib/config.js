const fs = require('fs');
const path = require('path');

let cfg = {};
const configPath = path.join(__dirname, '../config.json');
const exemplePath = path.join(__dirname, '../config.exemple.json');

if (fs.existsSync(configPath)) {
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Erreur lecture config.json:', e.message);
  }
} else if (fs.existsSync(exemplePath)) {
  try {
    cfg = JSON.parse(fs.readFileSync(exemplePath, 'utf8'));
  } catch (e) {
    console.error('Erreur lecture config.exemple.json:', e.message);
  }
}

const safeSecret = (val) => (typeof val === 'string' && val.length >= 32 && !val.includes('A_REMPLIR') ? val : null);

/**
 * Le secret qui signe les cookies de session. Il n'y a PAS de valeur de repli : il y en avait une, écrite en
 * clair dans ce fichier, donc versionnée — quiconque lisait le dépôt pouvait forger le cookie de n'importe
 * quel compte. Sans secret configuré, on en tire un au hasard au démarrage : plus rien n'est forgeable, et
 * comme les sessions ne survivent alors pas à un redémarrage, la mauvaise configuration se voit tout de suite.
 */
function secretDeSession() {
  const vrai = safeSecret(process.env.SECRET) || safeSecret(cfg.secret);
  if (vrai) return vrai;
  console.error('[SÉCURITÉ] Aucun secret de session configuré (variable SECRET ou site/config.json). '
    + 'Un secret aléatoire est utilisé : les connexions ne tiendront pas d\'un redémarrage à l\'autre. '
    + 'Définis SECRET avec 48 caractères aléatoires.');
  return require('crypto').randomBytes(48).toString('base64url');
}

const isCloud = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const getUrlPublique = () => {
  if (process.env.URL_PUBLIQUE) return process.env.URL_PUBLIQUE.replace(/\/$/, '');
  if (isCloud) return 'https://mcorbis.com';
  if (cfg.urlPublique && !cfg.urlPublique.includes('localhost') && !cfg.urlPublique.includes('127.0.0.1')) {
    return cfg.urlPublique.replace(/\/$/, '');
  }
  return isCloud ? 'https://mcorbis.com' : (cfg.urlPublique || 'http://localhost:8080');
};

module.exports = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : (cfg.port || 8080),
  urlPublique: getUrlPublique(),
  nomServeur: process.env.NOM_SERVEUR || cfg.nomServeur || 'OrbisMC',
  adresseJeu: process.env.ADRESSE_JEU || (cfg.adresseJeu && cfg.adresseJeu !== 'localhost' ? cfg.adresseJeu : '') || 'play.mcorbis.com',
  ouvert: ['true', 'false'].includes(process.env.SERVEUR_OUVERT) ? process.env.SERVEUR_OUVERT === 'true' : (cfg.ouvert !== undefined ? cfg.ouvert : false),
  versionJeu: process.env.VERSION_JEU || cfg.versionJeu || '1.21.4 à 26.2',
  discord: process.env.DISCORD || cfg.discord || 'https://discord.gg/Xeg7AH3X9B',
  youtube: process.env.YOUTUBE || cfg.youtube || 'https://www.youtube.com/@OrbisMinecraft',
  tiktok: process.env.TIKTOK || cfg.tiktok || 'https://www.tiktok.com/@serverorbismc',
  minecraft: {
    hote: process.env.MC_HOTE || (isCloud ? (process.env.ADRESSE_JEU || cfg.adresseJeu || 'play.mcorbis.com') : (cfg.minecraft && cfg.minecraft.hote) || '127.0.0.1'),
    port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : ((cfg.minecraft && cfg.minecraft.port) || 25565),
  },
  base: {
    hote: process.env.DB_HOTE || (cfg.base && cfg.base.hote) || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : ((cfg.base && cfg.base.port) || 3306),
    base: process.env.DB_NAME || (cfg.base && cfg.base.base) || 'serv',
    utilisateur: process.env.DB_USER || (cfg.base && cfg.base.utilisateur) || 'serv_web',
    motDePasse: process.env.DB_PASS || (cfg.base && cfg.base.motDePasse) || '',
  },
  secret: secretDeSession(),
  tebex: {
    jetonBoutique: process.env.TEBEX_JETON || (cfg.tebex && cfg.tebex.jetonBoutique) || '14p5o-868f6b575235d51f16e31c898907baf3561554c7',
  },
  courriel: {
    destinataire: process.env.EMAIL_DESTINATAIRE || process.env.CONTACT_EMAIL || (cfg.courriel && cfg.courriel.destinataire) || 'contact.orbis.server@gmail.com',
    smtp: {
      hote: process.env.SMTP_HOST || (cfg.courriel && cfg.courriel.smtp && cfg.courriel.smtp.hote) || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : ((cfg.courriel && cfg.courriel.smtp && cfg.courriel.smtp.port) || 465),
      utilisateur: process.env.SMTP_USER || process.env.GMAIL_USER || (cfg.courriel && cfg.courriel.smtp && cfg.courriel.smtp.utilisateur) || 'contact.orbis.server@gmail.com',
      motDePasse: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || (cfg.courriel && cfg.courriel.smtp && cfg.courriel.smtp.motDePasse) || '',
    },
  },
};
