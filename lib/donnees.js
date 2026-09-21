// Ce que le site lit (et, pour la boutique en gemmes, écrit) dans la base du serveur.
const { pool, requete, une } = require('./base');

const GRADES = ['fonda', 'admin', 'modo', 'youtuber', 'streamer', 'legende', 'elite', 'vip', 'habitue'];
const NOMS_GRADES = { fonda: 'Fonda', admin: 'Admin', modo: 'Modo', youtuber: 'YouTuber', streamer: 'Streamer', legende: 'Légende', elite: 'Élite', vip: 'VIP', habitue: 'Habitué', default: 'Joueur' };

async function chiffres() {
  try {
    const [j, t, r, f, v] = await Promise.all([
      une('SELECT COUNT(*) AS n FROM profils'),
      une('SELECT COALESCE(SUM(temps_jeu), 0) AS n FROM stats WHERE cle = "temps_jeu"'),
      une("SELECT COALESCE(SUM(valeur), 0) AS n FROM stats WHERE cle = 'td_raids_gagnes'"),
      une("SELECT COALESCE(SUM(valeur), 0) AS n FROM stats WHERE cle = 'lethal_ferraille'"),
      une("SELECT COALESCE(SUM(valeur), 0) AS n FROM stats WHERE cle = 'donjon_monstres'"),
    ]);
    return {
      joueurs: j && j.n ? Number(j.n) : 0,
      heures: t && t.n ? Math.floor(Number(t.n) / 3600000) : 0,
      raids: r && r.n ? Number(r.n) : 0,
      ferraille: f && f.n ? Number(f.n) : 0,
      monstresDonjon: v && v.n ? Number(v.n) : 0,
    };
  } catch (e) {
    return { joueurs: 0, heures: 0, raids: 0, ferraille: 0, monstresDonjon: 0 };
  }
}

// Classement d'une statistique (clé de la table stats), avec pseudo et cosmétiques affichés.
async function classement(cle, limite = 10) {
  try {
    return await requete(
      `SELECT p.pseudo, p.couleur, p.titre, s.valeur FROM stats s JOIN profils p ON p.uuid = s.uuid
       WHERE s.cle = ? ORDER BY s.valeur DESC, p.pseudo LIMIT ${Number(limite)}`, [cle]);
  } catch (e) {
    return [];
  }
}

async function classementTemps(limite = 10) {
  try {
    return await requete(`SELECT pseudo, couleur, titre, temps_jeu AS valeur FROM profils ORDER BY temps_jeu DESC LIMIT ${Number(limite)}`);
  } catch (e) {
    return [];
  }
}

async function grade(uuid) {
  try {
    const lignes = await requete("SELECT permission FROM luckperms_user_permissions WHERE uuid = ? AND permission LIKE 'group.%' AND value = 1", [uuid]);
    const groupes = lignes.map((l) => l.permission.slice(6));
    for (const g of GRADES) if (groupes.includes(g)) return g;
  } catch (e) {}
  return 'default';
}

async function equipe() {
  try {
    const lignes = await requete(
      `SELECT u.permission, p.username FROM luckperms_user_permissions u JOIN luckperms_players p ON p.uuid = u.uuid
       WHERE u.permission IN ('group.fonda', 'group.admin', 'group.modo') AND u.value = 1`);
    const ordre = { 'group.fonda': 0, 'group.admin': 1, 'group.modo': 2 };
    const pseudos = await requete('SELECT pseudo FROM profils');
    const casse = new Map(pseudos.map((l) => [l.pseudo.toLowerCase(), l.pseudo]));
    return lignes
      .sort((a, b) => ordre[a.permission] - ordre[b.permission])
      .map((l) => ({ pseudo: casse.get(l.username) || l.username, grade: l.permission.slice(6) }));
  } catch (e) {
    return [];
  }
}

async function profilPublic(pseudo) {
  try {
    const p = await une('SELECT uuid, pseudo, premiere, derniere, temps_jeu, couleur, titre, serveur FROM profils WHERE pseudo = ? ORDER BY derniere DESC LIMIT 1', [pseudo]);
    if (!p) return null;
    const stats = await requete('SELECT cle, valeur FROM stats WHERE uuid = ?', [p.uuid]);
    p.stats = Object.fromEntries(stats.map((s) => [s.cle, Number(s.valeur)]));
    p.grade = await grade(p.uuid);
    return p;
  } catch (e) {
    return null;
  }
}

async function profilPrive(uuid) {
  try {
    const p = await une('SELECT uuid, pseudo, gemmes, premiere, temps_jeu, couleur, titre, trainee, chapeau, compagnon FROM profils WHERE uuid = ?', [uuid]);
    if (!p) return null;
    const [stats, possedes, journal] = await Promise.all([
      requete('SELECT cle, valeur FROM stats WHERE uuid = ?', [uuid]),
      requete('SELECT id FROM cosmetiques WHERE uuid = ?', [uuid]),
      requete('SELECT delta, raison, serveur, date FROM gemmes_journal WHERE uuid = ? ORDER BY id DESC LIMIT 15', [uuid]),
    ]);
    p.stats = Object.fromEntries(stats.map((s) => [s.cle, Number(s.valeur)]));
    p.possedes = new Set(possedes.map((c) => c.id));
    p.journal = journal;
    p.grade = await grade(uuid);
    return p;
  } catch (e) {
    return null;
  }
}

async function catalogue() {
  try {
    return await requete('SELECT id, categorie, nom, prix, valeur, monnaie FROM catalogue ORDER BY ordre');
  } catch (e) {
    return [];
  }
}

// Achat d'un cosmétique en gemmes depuis le site : même règle qu'en jeu (retrait atomique, puis ajout).
async function acheterCosmetique(uuid, id) {
  try {
    const article = await une('SELECT id, categorie, nom, prix, monnaie FROM catalogue WHERE id = ?', [id]);
    if (!article) return { erreur: 'inconnu' };
    if (article.prix <= 0) return { erreur: 'offert' };
    if (article.monnaie && article.monnaie !== 'GEMMES') return { erreur: 'en_jeu' };
    const deja = await une('SELECT id FROM cosmetiques WHERE uuid = ? AND id = ?', [uuid, id]);
    if (deja) return { erreur: 'deja' };
    const colonne = { TITRE: 'titre', COULEUR: 'couleur' }[article.categorie] || (String(article.categorie).startsWith('UC_') ? null : undefined);
    if (colonne === undefined) return { erreur: 'inconnu' };
    const cnx = await pool.getConnection();
    try {
      await cnx.beginTransaction();
      const [retrait] = await cnx.execute('UPDATE profils SET gemmes = gemmes - ? WHERE uuid = ? AND gemmes >= ?', [article.prix, uuid, article.prix]);
      if (retrait.affectedRows !== 1) {
        await cnx.rollback();
        return { erreur: 'gemmes' };
      }
      await cnx.execute('INSERT INTO cosmetiques (uuid, id, date) VALUES (?, ?, ?)', [uuid, id, Date.now()]);
      await cnx.execute('INSERT INTO gemmes_journal (uuid, delta, raison, serveur, date) VALUES (?, ?, ?, ?, ?)',
        [uuid, -article.prix, `Cosmétique ${id}`, 'site', Date.now()]);
      if (colonne) await cnx.execute(`UPDATE profils SET ${colonne} = ? WHERE uuid = ?`, [id, uuid]);
      await cnx.commit();
      return { ok: 'achat' };
    } catch (e) {
      await cnx.rollback();
      throw e;
    } finally {
      cnx.release();
    }
  } catch (e) {
    return { erreur: 'base' };
  }
}

async function equiper(uuid, id) {
  try {
    const article = await une('SELECT id, categorie FROM catalogue WHERE id = ?', [id]);
    if (!article) return { erreur: 'inconnu' };
    const possede = await une('SELECT id FROM cosmetiques WHERE uuid = ? AND id = ?', [uuid, id]);
    if (!possede) return { erreur: 'pas_a_toi' };
    const colonne = { TITRE: 'titre', COULEUR: 'couleur' }[article.categorie];
    if (!colonne) return { erreur: 'inconnu' };
    await requete(`UPDATE profils SET ${colonne} = ? WHERE uuid = ?`, [id, uuid]);
    return { ok: 'equipe' };
  } catch (e) {
    return { erreur: 'base' };
  }
}

async function joueursRecents(limite = 500) {
  try {
    return await requete(`SELECT pseudo, derniere FROM profils ORDER BY derniere DESC LIMIT ${Number(limite)}`);
  } catch (e) {
    return [];
  }
}

module.exports = { joueursRecents, chiffres, classement, classementTemps, equipe, profilPublic, profilPrive, catalogue, acheterCosmetique, equiper, NOMS_GRADES };
