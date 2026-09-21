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

const defaultSecret = 'c8d4e9f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8';
const safeSecret = (val) => (typeof val === 'string' && val.length >= 32 && !val.includes('A_REMPLIR') ? val : null);

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
  adresseJeu: process.env.ADRESSE_JEU || cfg.adresseJeu || 'play.mcorbis.com',
  ouvert: process.env.SERVEUR_OUVERT === 'true' || cfg.ouvert === true,
  versionJeu: process.env.VERSION_JEU || '1.21 à 26.2',
  discord: process.env.DISCORD || cfg.discord || 'https://discord.gg/972PPSN7Fy',
  minecraft: {
    hote: process.env.MC_HOTE || (cfg.minecraft && cfg.minecraft.hote) || '127.0.0.1',
    port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : ((cfg.minecraft && cfg.minecraft.port) || 25565),
  },
  base: {
    hote: process.env.DB_HOTE || (cfg.base && cfg.base.hote) || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : ((cfg.base && cfg.base.port) || 3306),
    base: process.env.DB_NAME || (cfg.base && cfg.base.base) || 'serv',
    utilisateur: process.env.DB_USER || (cfg.base && cfg.base.utilisateur) || 'serv_web',
    motDePasse: process.env.DB_PASS || (cfg.base && cfg.base.motDePasse) || '',
  },
  secret: safeSecret(process.env.SECRET) || safeSecret(cfg.secret) || defaultSecret,
  tebex: {
    jetonBoutique: process.env.TEBEX_JETON || (cfg.tebex && cfg.tebex.jetonBoutique) || '',
  },
};
