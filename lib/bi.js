// Module Business Intelligence & Analytics pour OrbisMC
// Dashboard de suivi des indicateurs clés (SaaS Pro épuré 100% en Français)
const crypto = require('crypto');
const config = require('./config');
const { esc, nombre } = require('./html');
const { une, requete } = require('./base');

/*
 * Le mot de passe du tableau de bord ne vit PLUS dans ce fichier. Il y était écrit en clair, donc versionné :
 * quiconque lisait le dépôt entrait dans les indicateurs financiers du serveur. Il se règle par la variable
 * d'environnement BI_MDP. Sans elle, le tableau de bord se ferme au lieu de s'ouvrir avec un mot de passe connu.
 */
const MOT_DE_PASSE = typeof process.env.BI_MDP === 'string' && process.env.BI_MDP.length >= 12 ? process.env.BI_MDP : null;
const NOM_COOKIE = 'orbis_bi_auth';
const DUREE_COOKIE = 12 * 3600 * 1000; // 12 h : un tableau de bord n'a pas à rester ouvert un mois

if (!MOT_DE_PASSE) {
  console.error('[SÉCURITÉ] BI_MDP n\'est pas défini (12 caractères minimum) : le tableau de bord reste fermé.');
}

/** Le cookie porte sa propre expiration, signée avec : personne ne peut la prolonger. */
function signerAuth(expire = Date.now() + DUREE_COOKIE) {
  const sig = crypto.createHmac('sha256', config.secret).update(`bi|${MOT_DE_PASSE}|${expire}`).digest('base64url');
  return `${expire}.${sig}`;
}

function verifierAuth(req) {
  if (!MOT_DE_PASSE) return false;
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${NOM_COOKIE}=([^;]*)`));
  if (!match) return false;
  const [expire, sig] = String(match[1]).split('.');
  if (!expire || !sig || !/^\d+$/.test(expire) || Number(expire) < Date.now()) return false;
  return egal(sig, signerAuth(Number(expire)).split('.')[1]);
}

function verifierMotDePasse(saisi) {
  return !!MOT_DE_PASSE && typeof saisi === 'string' && egal(saisi, MOT_DE_PASSE);
}

/** Comparaison à durée constante, sans fuite par la longueur. */
function egal(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/*
 * Toutes les mesures viennent de la base, aucune n'est inventée. Chaque requête est isolée : si une table
 * manque ou si la base est injoignable, la mesure concernée vaut null et la carte affiche « — » au lieu de
 * faire tomber la page. C'est ce qui permet au tableau de bord de rester consultable pendant une panne.
 *
 * Repères du modèle : profils(uuid, pseudo, gemmes, premiere, derniere, temps_jeu, serveur),
 * gemmes_journal(uuid, delta, raison, serveur, date). Les gemmes ACHETÉES en euros arrivent par la commande
 * console « servgemmes » du proxy, avec la raison « Achat boutique » : c'est notre seul marqueur de revenu.
 */
const JOUR = 86400000;
const RAISON_ACHAT = 'Achat boutique';

async function essai(fn, defaut = null) {
  try {
    return await fn();
  } catch {
    return defaut;
  }
}

const n = (v) => (v === null || v === undefined ? null : Number(v));

async function chargerDonnees() {
  const maintenant = Date.now();
  const dbActive = await essai(async () => { await une('SELECT 1 AS n'); return true; }, false);
  if (!dbActive) return { dbActive: false, genere: maintenant };

  const [
    joueurs, heures, actifs, nouveaux, serveurs, gemmes, acheteurs, journalAchats, retention, tops, modes,
  ] = await Promise.all([
    essai(() => une('SELECT COUNT(*) AS n FROM profils')),
    essai(() => une('SELECT COALESCE(SUM(temps_jeu), 0) AS n FROM profils')),
    // Actifs à 1, 7 et 30 jours : la base de toute lecture d'audience.
    essai(() => une(`SELECT
        SUM(derniere >= ?) AS j1, SUM(derniere >= ?) AS j7, SUM(derniere >= ?) AS j30
      FROM profils`, [maintenant - JOUR, maintenant - 7 * JOUR, maintenant - 30 * JOUR])),
    // Inscriptions jour par jour sur 30 jours (courbe).
    essai(() => requete(`SELECT FLOOR(premiere / ?) AS jour, COUNT(*) AS n
      FROM profils WHERE premiere >= ? GROUP BY jour ORDER BY jour`, [JOUR, maintenant - 30 * JOUR]), []),
    essai(() => requete(`SELECT COALESCE(serveur, 'inconnu') AS serveur, COUNT(*) AS n
      FROM profils GROUP BY serveur ORDER BY n DESC`), []),
    essai(() => une('SELECT COALESCE(SUM(gemmes), 0) AS circulation, COUNT(*) AS n FROM profils')),
    // Combien de joueurs ont déjà payé, et combien de fois.
    essai(() => une(`SELECT COUNT(DISTINCT uuid) AS acheteurs, COUNT(*) AS commandes,
        COALESCE(SUM(delta), 0) AS gemmes
      FROM gemmes_journal WHERE raison = ? AND delta > 0`, [RAISON_ACHAT])),
    // Gemmes achetées jour par jour (courbe de revenu).
    essai(() => requete(`SELECT FLOOR(date / ?) AS jour, COALESCE(SUM(delta), 0) AS n, COUNT(DISTINCT uuid) AS clients
      FROM gemmes_journal WHERE raison = ? AND delta > 0 AND date >= ?
      GROUP BY jour ORDER BY jour`, [JOUR, RAISON_ACHAT, maintenant - 30 * JOUR]), []),
    // Rétention par cohorte : parmi ceux inscrits il y a N jours, combien sont revenus APRÈS ce cap.
    essai(() => une(`SELECT
        SUM(premiere <= ?) AS c1,  SUM(premiere <= ? AND derniere - premiere >= ?) AS r1,
        SUM(premiere <= ?) AS c7,  SUM(premiere <= ? AND derniere - premiere >= ?) AS r7,
        SUM(premiere <= ?) AS c30, SUM(premiere <= ? AND derniere - premiere >= ?) AS r30
      FROM profils`, [
      maintenant - JOUR, maintenant - JOUR, JOUR,
      maintenant - 7 * JOUR, maintenant - 7 * JOUR, 7 * JOUR,
      maintenant - 30 * JOUR, maintenant - 30 * JOUR, 30 * JOUR,
    ])),
    essai(() => requete(`SELECT pseudo, temps_jeu, gemmes, derniere FROM profils
      ORDER BY temps_jeu DESC LIMIT 10`), []),
    // Où les gemmes se gagnent : quel mode fait revenir les joueurs.
    essai(() => requete(`SELECT COALESCE(serveur, 'inconnu') AS serveur, COUNT(*) AS evenements,
        COUNT(DISTINCT uuid) AS joueurs
      FROM gemmes_journal WHERE date >= ? GROUP BY serveur ORDER BY evenements DESC LIMIT 8`,
    [maintenant - 30 * JOUR]), []),
  ]);

  const nbJoueurs = n(joueurs?.n) || 0;
  const nbAcheteurs = n(acheteurs?.acheteurs) || 0;
  const commandes = n(acheteurs?.commandes) || 0;
  const gemmesAchetees = n(acheteurs?.gemmes) || 0;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  return {
    dbActive: true,
    genere: maintenant,
    nbJoueurs,
    totalHeures: Math.floor((n(heures?.n) || 0) / 3600000),
    actifs: { j1: n(actifs?.j1) || 0, j7: n(actifs?.j7) || 0, j30: n(actifs?.j30) || 0 },
    // « Collant » : la part des actifs du mois qui jouent aussi aujourd'hui. Au-dessus de 20 %, c'est bon signe.
    collant: pct(n(actifs?.j1) || 0, n(actifs?.j30) || 0),
    inscriptions: serie(nouveaux, maintenant, (r) => n(r.n)),
    parServeur: (serveurs || []).map((r) => ({ serveur: String(r.serveur), n: n(r.n) })),
    activiteParServeur: (modes || []).map((r) => ({ serveur: String(r.serveur), evenements: n(r.evenements), joueurs: n(r.joueurs) })),
    gemmesEnCirculation: n(gemmes?.circulation) || 0,
    achats: {
      acheteurs: nbAcheteurs,
      commandes,
      gemmes: gemmesAchetees,
      conversion: pct(nbAcheteurs, nbJoueurs),
      commandesParAcheteur: nbAcheteurs > 0 ? Math.round((commandes / nbAcheteurs) * 100) / 100 : 0,
      gemmesParAcheteur: nbAcheteurs > 0 ? Math.round(gemmesAchetees / nbAcheteurs) : 0,
      serie: serie(journalAchats, maintenant, (r) => n(r.n)),
    },
    retention: {
      d1: pct(n(retention?.r1) || 0, n(retention?.c1) || 0),
      d7: pct(n(retention?.r7) || 0, n(retention?.c7) || 0),
      d30: pct(n(retention?.r30) || 0, n(retention?.c30) || 0),
      base: { d1: n(retention?.c1) || 0, d7: n(retention?.c7) || 0, d30: n(retention?.c30) || 0 },
    },
    top: (tops || []).map((r) => ({
      pseudo: String(r.pseudo), heures: Math.floor((n(r.temps_jeu) || 0) / 3600000),
      gemmes: n(r.gemmes) || 0, derniere: n(r.derniere) || 0,
    })),
  };
}

/** Complète une série SQL groupée par jour avec les jours vides : une courbe sans trous. */
function serie(lignes, maintenant, valeur) {
  const parJour = new Map((lignes || []).map((r) => [Number(r.jour), valeur(r) || 0]));
  const debut = Math.floor((maintenant - 29 * JOUR) / JOUR);
  const out = [];
  for (let k = 0; k < 30; k++) out.push({ jour: (debut + k) * JOUR, n: parJour.get(debut + k) || 0 });
  return out;
}

// Page de connexion secrète épurée SaaS
function vueLogin(res, erreur = '') {
  const v = Date.now().toString(36);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accès Réservé · Orbis Analytics</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/bi.css?v=${v}">
</head>
<body class="bi-body">
<div class="bi-login-wrap">
  <div class="bi-login-card">
    <span class="bi-badge-prive">Portail Fondateur · Privé</span>
    <h1>Tableau de bord Orbis</h1>
    <p>Authentification de sécurité requise pour accéder aux indicateurs financiers et métriques d'acquisition.</p>
    ${erreur ? `<div class="bi-alerte">${esc(erreur)}</div>` : ''}
    <form method="POST" action="">
      <input type="hidden" name="_csrf" value="${esc(res.locals.csrf)}">
      <div class="bi-champ">
        <label for="mdp">Mot de passe d'accès</label>
        <input type="password" id="mdp" name="mdp" placeholder="••••••••••••••••" autofocus required>
      </div>
      <button type="submit" class="bi-btn-login">Déverrouiller le Dashboard</button>
    </form>
  </div>
</div>
</body>
</html>`;
}

// Tableau de bord complet de Business Intelligence (SVG pur, interactif, zéro fausse donnée)
/* ------------------------------------------------------------------ rendu du tableau de bord
 *
 * Deux principes, et ils sont la raison d'être de cet écran :
 *  1. AUCUN chiffre inventé. Une mesure qu'on ne sait pas calculer affiche « — », jamais zéro : zéro est une
 *     information (« personne n'a acheté »), « — » en est une autre (« on ne sait pas »). Les confondre, c'est
 *     prendre des décisions sur du vide.
 *  2. Toute proportion est affichée avec sa BASE. « 50 % de rétention » ne veut rien dire si la cohorte compte
 *     deux joueurs : on écrit « 50 % · sur 2 joueurs ». C'est ce qui sépare un outil de pilotage d'une affiche.
 */

const rien = '<span class="bi-vide">—</span>';
const val = (x, suffixe = '') => (x === null || x === undefined ? rien : nombre(x) + suffixe);
const pourcent = (x) => (x === null || x === undefined ? rien : String(x).replace('.', ',') + ' %');
const jourCourt = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

/** Une courbe en SVG, sans script ni style en ligne : la politique de sécurité du site les interdit. */
function courbe(serie) {
  const pts = serie.map((x) => x.n);
  const max = Math.max(1, ...pts);
  const LARG = 720, HAUT = 160;
  const pas = pts.length > 1 ? LARG / (pts.length - 1) : LARG;
  const y = (k) => HAUT - 12 - (k / max) * (HAUT - 32);
  const chemin = pts.map((k, i) => `${i === 0 ? 'M' : 'L'}${(i * pas).toFixed(1)},${y(k).toFixed(1)}`).join(' ');
  const aire = `${chemin} L${LARG},${HAUT} L0,${HAUT} Z`;
  const total = pts.reduce((a, b) => a + b, 0);
  const points = pts.map((k, i) => `<circle class="bi-graph-pt" cx="${(i * pas).toFixed(1)}" cy="${y(k).toFixed(1)}" r="2.5"><title>${esc(jourCourt(serie[i].jour))} : ${nombre(k)}</title></circle>`).join('');
  return `<div class="bi-graph">
    <svg viewBox="0 0 ${LARG} ${HAUT}" role="img" aria-label="Évolution sur 30 jours, total ${total}" preserveAspectRatio="none">
      <path class="bi-graph-aire" d="${aire}"></path>
      <path class="bi-graph-trait" d="${chemin}"></path>
      ${points}
    </svg>
    <div class="bi-graph-axe"><span>${esc(jourCourt(serie[0].jour))}</span><span>${esc(jourCourt(serie[serie.length - 1].jour))}</span></div>
  </div>`;
}

/** Une barre horizontale par ligne : la répartition se lit d'un coup d'œil. */
function barres(lignes, cle) {
  const c = cle || 'n';
  if (!lignes.length) return '<p class="bi-empty-desc">Aucune donnée sur la période.</p>';
  const max = Math.max(1, ...lignes.map((l) => l[c]));
  const items = lignes.map((l) => `<li><span class="bi-barre-nom">${esc(l.serveur)}</span><span class="bi-barre-piste"><span class="bi-barre-part bi-p${Math.round((l[c] / max) * 20) * 5}"></span></span><span class="bi-barre-val">${nombre(l[c])}</span></li>`).join('');
  return `<ul class="bi-barres">${items}</ul>`;
}

function carteKpi(titre, valeur, pied) {
  return `<div class="bi-kpi-card"><div class="bi-kpi-title">${esc(titre)}</div><div class="bi-kpi-num">${valeur}</div><div class="bi-kpi-foot">${esc(pied)}</div></div>`;
}

function vueDashboard(d, res) {
  const v = Date.now().toString(36);
  const genere = new Date(d.genere).toLocaleString('fr-FR');
  let corps;
  if (!d.dbActive) {
    corps = `<div class="bi-empty-state"><div class="bi-empty-icon">⚠</div><div class="bi-empty-title">Base de données injoignable</div><div class="bi-empty-desc">Cet écran n'affiche que des mesures réelles : sans la base, il n'affiche rien. Tant que le site sera hébergé ailleurs que la base, il restera vide.</div></div>`;
  } else {
    const totalInscr = d.inscriptions.reduce((a, b) => a + b.n, 0);
    const totalAchats = d.achats.serie.reduce((a, b) => a + b.n, 0);
    const coh = [['J+1', d.retention.d1, d.retention.base.d1], ['J+7', d.retention.d7, d.retention.base.d7], ['J+30', d.retention.d30, d.retention.base.d30]];
    const cartesRet = coh.map((x) => `<div class="bi-retention-card"><div class="bi-retention-top">${esc(x[0])}</div><div class="bi-retention-score">${pourcent(x[1])}</div><div class="bi-retention-desc">sur ${nombre(x[2])} joueur${x[2] > 1 ? 's' : ''} éligible${x[2] > 1 ? 's' : ''}</div></div>`).join('');
    const lignesTop = d.top.map((j) => `<tr><td>${esc(j.pseudo)}</td><td>${nombre(j.heures)} h</td><td>${nombre(j.gemmes)}</td><td>${j.derniere ? esc(new Date(j.derniere).toLocaleDateString('fr-FR')) : rien}</td></tr>`).join('');
    const tableau = d.top.length ? `<table class="bi-table"><thead><tr><th>Joueur</th><th>Heures</th><th>Gemmes</th><th>Dernière connexion</th></tr></thead><tbody>${lignesTop}</tbody></table>` : '<p class="bi-empty-desc">Aucun joueur enregistré.</p>';
    corps = `<section class="bi-pilotage">
      <div class="bi-title-row"><h3>Audience</h3><span class="bi-pill">mesuré sur 30 jours</span></div>
      <div class="bi-kpi-grid">
        ${carteKpi('Joueurs inscrits', val(d.nbJoueurs), "Comptes créés depuis l'ouverture")}
        ${carteKpi('Actifs aujourd\u2019hui', val(d.actifs.j1), 'Vus dans les 24 dernières heures')}
        ${carteKpi('Actifs sur 7 jours', val(d.actifs.j7), 'Base hebdomadaire réelle')}
        ${carteKpi('Actifs sur 30 jours', val(d.actifs.j30), 'Base mensuelle réelle')}
        ${carteKpi('Fidélité', pourcent(d.collant), 'Part des actifs du mois qui jouent aujourd\u2019hui. Au-delà de 20 %, la communauté tient.')}
        ${carteKpi('Heures jouées', val(d.totalHeures, ' h'), 'Cumul de tous les comptes')}
      </div>
      <div class="bi-card-box"><div class="bi-card-head"><h4>Nouvelles inscriptions par jour</h4>
        <span class="bi-badge-blue">${nombre(totalInscr)} sur 30 jours</span></div>${courbe(d.inscriptions)}</div>
      <div class="bi-title-row"><h3>Revenus</h3><span class="bi-pill">gemmes payées en euros</span></div>
      <div class="bi-kpi-grid">
        ${carteKpi('Acheteurs', val(d.achats.acheteurs), 'Joueurs ayant payé au moins une fois')}
        ${carteKpi('Taux de conversion', pourcent(d.achats.conversion), `Sur ${nombre(d.nbJoueurs)} inscrits`)}
        ${carteKpi('Commandes', val(d.achats.commandes), 'Toutes livraisons confondues')}
        ${carteKpi('Commandes par acheteur', val(d.achats.commandesParAcheteur), 'Au-dessus de 1, il y a du réachat')}
        ${carteKpi('Gemmes achetées', val(d.achats.gemmes), 'Volume total livré')}
        ${carteKpi('Gemmes par acheteur', val(d.achats.gemmesParAcheteur), 'Panier moyen, en gemmes')}
      </div>
      <div class="bi-card-box"><div class="bi-card-head"><h4>Gemmes achetées par jour</h4>
        <span class="bi-badge-green">${nombre(totalAchats)} sur 30 jours</span></div>${courbe(d.achats.serie)}
        <p class="bi-note-benchmark">Source : journal des gemmes, raison « Achat boutique » — la seule écriture
        déclenchée par un paiement réel. Les gemmes gagnées en jouant n'entrent pas dans ce calcul.</p></div>
      <div class="bi-title-row"><h3>Rétention</h3><span class="bi-pill">par cohorte</span></div>
      <div class="bi-retention-grid">${cartesRet}</div>
      <p class="bi-note-benchmark">Un joueur est « retenu » à J+N si sa dernière connexion tombe au moins N jours
      après son inscription. Une cohorte trop petite rend le pourcentage ininterprétable : sa taille est donc affichée.</p>
      <div class="bi-dual-grid">
        <div class="bi-card-box"><div class="bi-card-head"><h4>Inscriptions par serveur d'arrivée</h4></div>
          ${barres(d.parServeur)}</div>
        <div class="bi-card-box"><div class="bi-card-head"><h4>Activité par mode</h4></div>
          ${barres(d.activiteParServeur, 'joueurs')}
          <p class="bi-note-benchmark">Joueurs distincts ayant gagné ou dépensé des gemmes sur ce serveur, sur 30 jours.</p></div>
      </div>
      <div class="bi-card-box"><div class="bi-card-head"><h4>Les dix joueurs les plus assidus</h4>
        <span class="bi-badge-amber">${nombre(d.gemmesEnCirculation)} gemmes en circulation</span></div>${tableau}</div>
    </section>`;
  }
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pilotage · OrbisMC</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/bi.css?v=${v}">
</head>
<body class="bi-body">
<div class="bi-layout">
  <aside class="bi-sidebar">
    <div class="bi-sidebar-head"><h2>Pilotage OrbisMC</h2></div>
    <div class="bi-filter-group"><label>État de la source</label>
      <div class="bi-select-box">${d.dbActive ? 'Base connectée' : 'Base injoignable'}</div></div>
    <div class="bi-filter-group"><label>Dernière mesure</label>
      <div class="bi-select-box">${esc(genere)}</div></div>
    <div class="bi-callout-info"><b>Ce que cet écran n'invente pas.</b>
      Chaque nombre vient d'une requête sur la base. Ce qui n'est pas mesurable affiche « — ».
      Les pourcentages sont donnés avec la taille de leur échantillon.</div>
    <div class="bi-filter-actions"><form method="POST" action="/bi-analytics-9834x"><input type="hidden" name="_csrf" value="${esc(res.locals.csrf)}"><input type="hidden" name="deconnexion" value="1"><button class="bi-btn-logout" type="submit">Se déconnecter</button></form></div>
  </aside>
  <main class="bi-main">
    <div class="bi-topbar"><div class="bi-title-row"><h1>Tableau de bord</h1></div>
      <span class="bi-time-badge">Mesuré le ${esc(genere)}</span></div>
    <div class="bi-content">${corps}</div>
  </main>
</div>
</body>
</html>`;
}
module.exports = {
  verifierAuth,
  verifierMotDePasse,
  signerAuth,
  NOM_COOKIE,
  DUREE_COOKIE,
  chargerDonnees,
  vueLogin,
  vueDashboard,
};
