// Accès à la base MariaDB partagée avec le serveur de jeu (utilisateur serv_web aux droits réduits).
const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.base.hote,
  port: config.base.port,
  database: config.base.base,
  user: config.base.utilisateur,
  password: config.base.motDePasse,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 8,
  connectTimeout: 3000,
  queueLimit: 32,
  supportBigNumbers: true,
  bigNumberStrings: false,
});

async function requete(sql, params = []) {
  const [lignes] = await pool.execute(sql, params);
  return lignes;
}

async function une(sql, params = []) {
  const lignes = await requete(sql, params);
  return lignes[0] || null;
}

const CODES_INDISPONIBLES = new Set(['ECONNREFUSED','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH','ECONNRESET','PROTOCOL_CONNECTION_LOST','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','ER_NO_SUCH_TABLE']);
const erreurDisponibilite = e => CODES_INDISPONIBLES.has(e?.code);
let etatDisponible = false, disponibleJusqua = 0, verification = null;
async function disponible() {
  // Une adresse locale sur Vercel ne peut pas joindre la base du PC : inutile d'attendre un timeout.
  if (process.env.VERCEL && ['127.0.0.1','localhost','::1'].includes(config.base.hote)) return false;
  if (Date.now() < disponibleJusqua) return etatDisponible;
  if (!verification) verification = requete('SELECT 1').then(()=>{etatDisponible=true;}).catch(e=>{
    if (!erreurDisponibilite(e)) throw e;
    etatDisponible=false;
  }).then(()=>{disponibleJusqua=Date.now()+30000;return etatDisponible;}).finally(()=>{verification=null;});
  return verification;
}
function signalerIndisponibilite() { etatDisponible=false; disponibleJusqua=Date.now()+30000; }
module.exports = { pool, requete, une, disponible, erreurDisponibilite, signalerIndisponibilite };
