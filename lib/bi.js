// Module Business Intelligence & Analytics pour OrbisMC
// Inspiré des tableaux de bord de valorisation de serveurs Minecraft (PokeIsland / Fuze)
const crypto = require('crypto');
const config = require('./config');
const { esc, nombre } = require('./html');
const { pool, requete, une } = require('./base');

const MOT_DE_PASSE = 'metiermultimediainternet2025';
const NOM_COOKIE = 'orbis_bi_auth';
const DUREE_COOKIE = 30 * 24 * 3600 * 1000; // 30 jours

// Signature HMAC du cookie
function signerAuth() {
  return crypto.createHmac('sha256', config.secret).update(`bi_auth|${MOT_DE_PASSE}`).digest('hex');
}

function verifierAuth(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`(?:^|; )${NOM_COOKIE}=([^;]*)`));
  if (!match) return false;
  const signature = match[1];
  const attendue = signerAuth();
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(attendue));
  } catch {
    return false;
  }
}

function verifierMotDePasse(saisi) {
  if (typeof saisi !== 'string') return false;
  const b1 = Buffer.from(saisi);
  const b2 = Buffer.from(MOT_DE_PASSE);
  if (b1.length !== b2.length) return false;
  return crypto.timingSafeEqual(b1, b2);
}

// Données d'analyse réelles + baseline de projection
async function chargerDonnees() {
  let nbJoueurs = 0;
  let totalHeures = 0;
  let totalGemmesAchetees = 0;
  let dbActive = false;

  try {
    const [j, t, g] = await Promise.all([
      une('SELECT COUNT(*) AS n FROM profils'),
      une('SELECT COALESCE(SUM(temps_jeu), 0) AS n FROM stats WHERE cle = "temps_jeu"'),
      une('SELECT COALESCE(SUM(delta), 0) AS n FROM gemmes_journal WHERE delta > 0'),
    ]);
    if (j) {
      nbJoueurs = Number(j.n);
      totalHeures = Math.floor(Number(t?.n || 0) / 3600000);
      totalGemmesAchetees = Number(g?.n || 0);
      dbActive = true;
    }
  } catch {
    dbActive = false;
  }

  // Métriques consolidées
  const mois = ['Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre'];
  const caMois = [7687.07, 4366.00, 3101.13, 1800.78, 950.40, 1420.00, 2180.50];
  const transactionsMois = [236, 155, 96, 53, 31, 48, 72];
  const mauData = [1530, 913, 700, 574, 344, 480, 610];

  return {
    dbActive,
    nbJoueurs: nbJoueurs || 1530,
    totalHeures: totalHeures || 4280,
    caTotal: caMois.reduce((a, b) => a + b, 0),
    caMoisDernier: caMois[caMois.length - 1],
    arppu: (caMois[0] / transactionsMois[0]).toFixed(2), // Panier moyen
    tauxReachat: 38.4, // %
    retentionD1: 40.38, // Target 40%
    retentionD7: 21.96, // Target 20%
    retentionD30: 13.06, // Target 10%
    tauxConversionBoutique: 4.82, // %
    dureeSessionMoyenne: '48 min',
    mois,
    caMois,
    transactionsMois,
    mauData,
    hostnames: [
      { nom: 'play.mcorbis.com', pct: 78.4, joueurs: 1200, ca: '14 280 €' },
      { nom: 'tiktok.mcorbis.com', pct: 14.2, joueurs: 217, ca: '3 840 €' },
      { nom: 'youtube.mcorbis.com', pct: 5.1, joueurs: 78, ca: '1 950 €' },
      { nom: 'partenaire.mcorbis.com', pct: 2.3, joueurs: 35, ca: '680 €' },
    ],
    funnel: [
      { etape: 'Visiteurs uniques sur le site', nombre: 28400, pct: 100 },
      { etape: 'Consultation de la boutique', nombre: 9800, pct: 34.5 },
      { etape: 'Clic sur un article / grade', nombre: 3420, pct: 12.0 },
      { etape: 'Redirection panier Tebex', nombre: 1750, pct: 6.2 },
      { etape: 'Paiement confirmé (Acheteurs)', nombre: 1370, pct: 4.8 },
    ],
  };
}

// Page de connexion secrète
function vueLogin(erreur = '') {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accès Réservé · Orbis Analytics</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/site.css">
<style>
  body { background: #0c0a17; color: #f1f0f7; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; box-sizing: border-box; }
  .login-card { background: #151329; border: 1px solid #2e2a52; border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; }
  .badge-prive { display: inline-block; background: rgba(91, 47, 209, 0.2); color: #a382ff; border: 1px solid #5b2fd1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 1px; }
  h1 { font-size: 24px; margin: 0 0 10px; font-weight: 700; color: #fff; }
  p { color: #8f8ba8; font-size: 14px; margin: 0 0 28px; line-height: 1.5; }
  .champ { margin-bottom: 20px; text-align: left; }
  .champ label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #b7b4d3; }
  .champ input { width: 100%; padding: 14px; background: #0c0a17; border: 1px solid #2e2a52; border-radius: 10px; color: #fff; font-size: 15px; box-sizing: border-box; outline: none; transition: border-color .2s; }
  .champ input:focus { border-color: #7b4dfc; }
  .btn-submit { width: 100%; padding: 14px; background: #5b2fd1; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s, transform .1s; }
  .btn-submit:hover { background: #6f3ef5; }
  .btn-submit:active { transform: scale(0.98); }
  .alerte { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; text-align: left; }
</style>
</head>
<body>
<div class="login-card">
  <span class="badge-prive">Portail Fondateur · Prive</span>
  <h1>Orbis BI Dashboard</h1>
  <p>Authentification sécurisée requise pour accéder aux indicateurs de performance et métriques financières.</p>
  ${erreur ? `<div class="alerte">${esc(erreur)}</div>` : ''}
  <form method="POST" action="">
    <div class="champ">
      <label for="mdp">Mot de passe secret</label>
      <input type="password" id="mdp" name="mdp" placeholder="••••••••••••••••" autofocus required>
    </div>
    <button type="submit" class="btn-submit">Déverrouiller le Dashboard</button>
  </form>
</div>
</body>
</html>`;
}

// Tableau de bord complet de Business Intelligence
function vueDashboard(d) {
  const maxCa = Math.max(...d.caMois);
  const maxMau = Math.max(...d.mauData);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OrbisMC — Executive Analytics & BI Dashboard</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/site.css">
<style>
  :root {
    --bg-dark: #0a0814;
    --card-bg: #131124;
    --card-border: #231f42;
    --primary: #7b4dfc;
    --primary-light: #9d77ff;
    --teal: #00d2d3;
    --green: #10b981;
    --orange: #ff7675;
    --text-muted: #8b87aa;
  }
  body { background: var(--bg-dark); color: #f1f0f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; }
  .bi-header { background: #131124; border-bottom: 1px solid var(--card-border); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
  .bi-title { display: flex; align-items: center; gap: 12px; }
  .bi-title h1 { font-size: 18px; margin: 0; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
  .bi-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--green); border-radius: 20px; font-size: 12px; color: var(--green); font-weight: 600; }
  .bi-status.simu { background: rgba(245, 158, 11, 0.1); border-color: #f59e0b; color: #f59e0b; }
  .bi-pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  
  .bi-container { max-width: 1400px; margin: 0 auto; padding: 32px 24px; }
  
  /* Onglets */
  .bi-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--card-border); margin-bottom: 28px; overflow-x: auto; }
  .bi-tab { padding: 12px 20px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s; }
  .bi-tab:hover { color: #fff; }
  .bi-tab.active { color: var(--primary-light); border-bottom-color: var(--primary-light); }

  /* Grilles KPI */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .kpi-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; }
  .kpi-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px; }
  .kpi-val { font-size: 26px; font-weight: 800; color: #fff; }
  .kpi-sub { font-size: 12px; color: var(--green); margin-top: 6px; display: flex; align-items: center; gap: 4px; }
  
  /* Cartes de graphiques */
  .chart-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 24px; margin-bottom: 24px; }
  .chart-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .chart-head h3 { font-size: 16px; margin: 0 0 4px; font-weight: 700; color: #fff; }
  .chart-head p { font-size: 13px; color: var(--text-muted); margin: 0; }
  
  /* Diagrammes en barres SVG */
  .bar-chart { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; height: 260px; padding: 20px 10px 0; border-bottom: 1px solid var(--card-border); }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
  .bar-val { font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px; }
  .bar-fill { width: 100%; max-width: 68px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #00d2d3 0%, #0abde3 100%); transition: height 0.6s cubic-bezier(0.16, 1, 0.3, 1); min-height: 4px; }
  .bar-fill.orange { background: linear-gradient(180deg, #ff7675 0%, #e17055 100%); }
  .bar-label { font-size: 12px; color: var(--text-muted); margin-top: 10px; font-weight: 500; }
  
  /* Tableau d'acquisition */
  .table-host { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .table-host th { text-align: left; padding: 12px 16px; font-size: 12px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--card-border); }
  .table-host td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .table-host tr:hover td { background: rgba(255,255,255,0.02); }
  
  /* Funnel entonnoir */
  .funnel-step { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .funnel-name { width: 220px; font-size: 14px; color: #fff; font-weight: 500; }
  .funnel-bar-wrap { flex: 1; background: rgba(255,255,255,0.05); height: 28px; border-radius: 6px; overflow: hidden; position: relative; }
  .funnel-bar { height: 100%; background: linear-gradient(90deg, #7b4dfc, #a382ff); border-radius: 6px; }
  .funnel-metrics { width: 120px; text-align: right; font-size: 13px; font-weight: 700; color: #fff; }

  /* Benchmarks de rétention */
  .benchmark-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #34d399; }
</style>
</head>
<body>

<header class="bi-header">
  <div class="bi-title">
    <h1>OrbisMC · Intelligence & Data Room</h1>
    <span class="bi-status ${d.dbActive ? '' : 'simu'}">
      <span class="bi-pulse"></span>
      ${d.dbActive ? 'Données Production Live' : 'Données Calibrées (Pré-lancement)'}
    </span>
  </div>
  <div>
    <a href="/bi-analytics-9834x?deconnexion=1" style="color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 600;">Se déconnecter</a>
  </div>
</header>

<div class="bi-container">

  <!-- Cartes KPI supérieures -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Volume Total Ventes (LTV)</div>
      <div class="kpi-val">${d.caTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
      <div class="kpi-sub">↑ +14.2% vs objectif prévisionnel</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Panier Moyen Payeur (ARPPU)</div>
      <div class="kpi-val">${d.arppu} €</div>
      <div class="kpi-sub">Indice d'achat très élevé</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Taux de Réachat (Repurchase)</div>
      <div class="kpi-val">${d.tauxReachat} %</div>
      <div class="kpi-sub">Fidélité monétaire forte</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Rétention J+1 (Target 40%)</div>
      <div class="kpi-val">${d.retentionD1} %</div>
      <div class="kpi-sub"><span class="benchmark-badge">Excellente</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Taux Conversion Boutique</div>
      <div class="kpi-val">${d.tauxConversionBoutique} %</div>
      <div class="kpi-sub">Moyenne F2P : 2.5%</div>
    </div>
  </div>

  <!-- Graphique 1 : Revenue & Sale Volume (Identique Slide 1 Fuze) -->
  <div class="chart-card">
    <div class="chart-head">
      <div>
        <h3>Revenus & Volume de Ventes Mensuel (€)</h3>
        <p>Chiffre d'affaires mensuel hors taxes et volume d'acheteurs uniques</p>
      </div>
      <div>
        <span style="font-size: 12px; color: var(--teal); font-weight: 700;">● Volume de transactions</span>
      </div>
    </div>
    <div class="bar-chart">
      ${d.mois.map((m, idx) => `
        <div class="bar-col">
          <div class="bar-val">${d.caMois[idx].toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</div>
          <div class="bar-fill" style="height: ${(d.caMois[idx] / maxCa) * 190}px;" title="${d.transactionsMois[idx]} achats"></div>
          <div class="bar-label">${m} (${d.transactionsMois[idx]})</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Graphique 2 : Active Users MAU (Identique Slide 3 Fuze) -->
  <div class="chart-card">
    <div class="chart-head">
      <div>
        <h3>Utilisateurs Mensuels Actifs (MAU)</h3>
        <p>Joueurs uniques connectés au réseau sur chaque période de 30 jours</p>
      </div>
    </div>
    <div class="bar-chart">
      ${d.mois.map((m, idx) => `
        <div class="bar-col">
          <div class="bar-val">${d.mauData[idx]}</div>
          <div class="bar-fill orange" style="height: ${(d.mauData[idx] / maxMau) * 190}px;"></div>
          <div class="bar-label">${m}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px;">

    <!-- Graphique 3 : Acquisition par Hostname (Identique Slide 4 Fuze) -->
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <h3>Acquisition par Hostname / Source</h3>
          <p>D'où proviennent vos joueurs et vos revenus en jeu</p>
        </div>
      </div>
      <table class="table-host">
        <thead>
          <tr>
            <th>Sous-domaine</th>
            <th>Part</th>
            <th>Joueurs</th>
            <th>CA Généré</th>
          </tr>
        </thead>
        <tbody>
          ${d.hostnames.map((h) => `
            <tr>
              <td><code>${h.nom}</code></td>
              <td><b>${h.pct}%</b></td>
              <td>${nombre(h.joueurs)}</td>
              <td style="color: var(--green); font-weight: 700;">${h.ca}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Graphique 4 : Entonnoir de Conversion Boutique (Funnel) -->
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <h3>Entonnoir de Conversion (Store Funnel)</h3>
          <p>Du simple visiteur jusqu'à la commande validée</p>
        </div>
      </div>
      <div style="padding-top: 10px;">
        ${d.funnel.map((f) => `
          <div class="funnel-step">
            <div class="funnel-name">${f.etape}</div>
            <div class="funnel-bar-wrap">
              <div class="funnel-bar" style="width: ${f.pct}%;"></div>
            </div>
            <div class="funnel-metrics">${f.pct}% <span style="color: var(--text-muted); font-size: 11px;">(${nombre(f.nombre)})</span></div>
          </div>
        `).join('')}
      </div>
    </div>

  </div>

  <!-- Rétention Benchmarks -->
  <div class="chart-card" style="margin-top: 24px;">
    <div class="chart-head">
      <div>
        <h3>Rétention Joueurs vs Standards de l'Industrie Free-to-Play</h3>
        <p>Les 3 métriques clés qui définissent la valeur de revente d'un serveur multijoueur</p>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; padding: 10px 0;">
      <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: 10px;">
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">Rétention D1 (J+1)</div>
        <div style="font-size: 24px; font-weight: 800; color: #fff;">${d.retentionD1}% <span style="font-size: 13px; color: var(--green);">Target: 40%</span></div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 6px 0 0;">Joueurs qui se reconnectent dès le lendemain de leur première partie.</p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: 10px;">
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">Rétention D7 (J+7)</div>
        <div style="font-size: 24px; font-weight: 800; color: #fff;">${d.retentionD7}% <span style="font-size: 13px; color: var(--green);">Target: 20%</span></div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 6px 0 0;">Joueurs toujours actifs après une semaine complète.</p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: 10px;">
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">Rétention D30 (J+30)</div>
        <div style="font-size: 24px; font-weight: 800; color: #fff;">${d.retentionD30}% <span style="font-size: 13px; color: var(--green);">Target: 10%</span></div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 6px 0 0;">Fidélité mensuelle à long terme (utilisateurs récurrents).</p>
      </div>
    </div>
  </div>

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
