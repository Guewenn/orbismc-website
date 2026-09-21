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

module.exports = { pool, requete, une };
