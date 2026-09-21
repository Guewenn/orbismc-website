// Module Business Intelligence & Analytics pour OrbisMC
// Dashboard de suivi des indicateurs clés (SaaS Pro épuré)
const crypto = require('crypto');
const config = require('./config');
const { esc, nombre } = require('./html');
const { une } = require('./base');

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

// Données 100% réelles tirées de la base (zéro fausse donnée)
async function chargerDonnees() {
  let nbJoueurs = 0;
  let totalHeures = 0;
  let dbActive = false;

  try {
    const [j, t] = await Promise.all([
      une('SELECT COUNT(*) AS n FROM profils'),
      une('SELECT COALESCE(SUM(temps_jeu), 0) AS n FROM stats WHERE cle = "temps_jeu"'),
    ]);
    if (j && j.n) {
      nbJoueurs = Number(j.n);
      totalHeures = Math.floor(Number(t?.n || 0) / 3600000);
      dbActive = true;
    }
  } catch {
    dbActive = false;
  }

  return {
    dbActive,
    nbJoueurs: nbJoueurs || 0,
    totalHeures: totalHeures || 0,
    caTotal: 0,
    caMoisDernier: 0,
    arppu: '0.00',
    tauxReachat: 0,
    retentionD1: 0,
    retentionD7: 0,
    retentionD30: 0,
    tauxConversionBoutique: 0,
    mois: ['Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre'],
    caMois: [0, 0, 0, 0, 0, 0, 0],
    transactionsMois: [0, 0, 0, 0, 0, 0, 0],
    mauData: [0, 0, 0, 0, 0, 0, 0],
    hostnames: [
      { nom: 'play.mcorbis.com', pct: 0, joueurs: 0, ca: '0,00 €' },
      { nom: 'tiktok.mcorbis.com', pct: 0, joueurs: 0, ca: '0,00 €' },
      { nom: 'youtube.mcorbis.com', pct: 0, joueurs: 0, ca: '0,00 €' },
    ],
    funnel: [
      { etape: 'Visiteurs uniques sur le site', nombre: 0, pct: 0, width: 0 },
      { etape: 'Consultation de la boutique', nombre: 0, pct: 0, width: 0 },
      { etape: 'Clic sur un article / grade', nombre: 0, pct: 0, width: 0 },
      { etape: 'Redirection panier Tebex', nombre: 0, pct: 0, width: 0 },
      { etape: 'Paiement confirmé (Acheteurs)', nombre: 0, pct: 0, width: 0 },
    ],
  };
}

// Page de connexion secrète épurée SaaS
function vueLogin(erreur = '') {
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
    <h1>Orbis BI Dashboard</h1>
    <p>Authentification de sécurité requise pour accéder aux indicateurs financiers et métriques d'acquisition.</p>
    ${erreur ? `<div class="bi-alerte">${esc(erreur)}</div>` : ''}
    <form method="POST" action="">
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

// Tableau de bord complet de Business Intelligence (SVG pur, zéro fausse donnée, conforme CSP)
function vueDashboard(d) {
  const v = Date.now().toString(36);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OrbisMC — Executive Analytics & BI Dashboard</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/bi.css?v=${v}">
</head>
<body class="bi-body">

<div class="bi-layout">

  <!-- Sidebar Filtres (identique au dashboard de la vidéo) -->
  <aside class="bi-sidebar">
    <div class="bi-sidebar-head">
      <h2>Filters</h2>
    </div>

    <div class="bi-filter-group">
      <label>Project</label>
      <div class="bi-select-box">OrbisMC (Minecraft Java)</div>
    </div>

    <div class="bi-filter-group">
      <label>Date Range</label>
      <div class="bi-select-box">Temps réel (Live)</div>
    </div>

    <div class="bi-filter-group">
      <label>Country</label>
      <div class="bi-select-box">Tous les pays</div>
    </div>

    <div class="bi-filter-group">
      <label>Hostname</label>
      <div class="bi-select-box">Tous les sous-domaines</div>
    </div>

    <div class="bi-filter-group">
      <label>Buyer segment <span class="bi-info">ⓘ</span></label>
      <div class="bi-select-box">Tous les segments</div>
    </div>

    <div class="bi-filter-group">
      <label>Playtime segment <span class="bi-info">ⓘ</span></label>
      <div class="bi-select-box">Tous les temps de jeu</div>
    </div>

    <div class="bi-filter-group">
      <label>Inactivity Day <span class="bi-info">ⓘ</span></label>
      <div class="bi-range-track">
        <div class="bi-range-bar"></div>
        <div class="bi-range-handle"></div>
      </div>
      <div class="bi-range-label">0 - 30 jours</div>
    </div>

    <div class="bi-filter-group">
      <label>Platform</label>
      <div class="bi-select-box">Java Edition (PC / Mac)</div>
    </div>

    <div class="bi-filter-actions">
      <button type="button" class="bi-btn-filter">Appliquer les filtres</button>
      <button type="button" class="bi-btn-clear">Réinitialiser</button>
    </div>
  </aside>

  <!-- Zone Principale -->
  <main class="bi-main">

    <!-- Topbar épurée -->
    <header class="bi-topbar">
      <div class="bi-topbar-left">
        <div class="bi-title-row">
          <h1>Dashboard</h1>
          <span class="bi-star">★</span>
          <span class="bi-refresh-icon">↻</span>
          <span class="bi-status-dot"></span>
          <span class="bi-time-badge">${d.dbActive ? 'Base de données connectée' : 'Mode pré-lancement'}</span>
        </div>
        <nav class="bi-tabs-main">
          <a href="#" class="bi-tab-main active">Overview</a>
          <a href="#" class="bi-tab-main">Features</a>
          <a href="#" class="bi-tab-main">Documentation</a>
        </nav>
      </div>
      <div class="bi-topbar-right">
        <a href="/bi-analytics-9834x?deconnexion=1" class="bi-btn-logout">Déconnexion</a>
      </div>
    </header>

    <div class="bi-content">

      <!-- Sous-navigation (Ventes & Métriques) -->
      <div class="bi-subnav-row">
        <div class="bi-subtabs">
          <span class="bi-subtab">Daily Sales</span>
          <span class="bi-subtab">Weekly Sales</span>
          <span class="bi-subtab active">Monthly Sales</span>
          <span class="bi-subtab">Repurchase</span>
          <span class="bi-subtab">Tebex Fees Breakdown</span>
        </div>
      </div>

      <div class="bi-subnav-row">
        <div class="bi-pills">
          <span class="bi-pill">Per Country</span>
          <span class="bi-pill active">Per Hostname</span>
          <span class="bi-pill">Per Buyer Category</span>
          <span class="bi-pill">Per Playtime</span>
          <span class="bi-pill">Per Product (Tebex)</span>
          <span class="bi-pill">Per Product (in-game)</span>
          <span class="bi-pill">Per ARPP</span>
          <span class="bi-pill">Per % Purchase</span>
        </div>
      </div>

      <!-- KPIs Rapides (100% réels) -->
      <div class="bi-kpi-grid">
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Volume Total Ventes (LTV)</div>
          <div class="bi-kpi-num">${d.caTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
          <div class="bi-kpi-foot">En attente du lancement officiel</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Panier Moyen Payeur (ARPPU)</div>
          <div class="bi-kpi-num">${d.arppu} €</div>
          <div class="bi-kpi-foot">Calculé dès les premiers achats</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Taux de Réachat (Repurchase)</div>
          <div class="bi-kpi-num">—</div>
          <div class="bi-kpi-foot">Actif après les 2e commandes</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Joueurs Enregistrés (SQL)</div>
          <div class="bi-kpi-num">${nombre(d.nbJoueurs)}</div>
          <div class="bi-kpi-foot good">${d.dbActive ? 'Synchronisé en direct' : 'En attente des comptes'}</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Temps de Jeu Cumulé</div>
          <div class="bi-kpi-num">${nombre(d.totalHeures)} h</div>
          <div class="bi-kpi-foot">Stats multijoueur réelles</div>
        </div>
      </div>

      <!-- Graphique 1 : Revenue & sale volume (Vide propre pré-lancement) -->
      <div class="bi-card-box">
        <div class="bi-card-head">
          <div>
            <h3>Revenue & sale volume</h3>
            <p>Chiffre d'affaires mensuel net (€) et volume d'acheteurs uniques</p>
          </div>
        </div>
        <div class="bi-empty-state">
          <div class="bi-empty-icon">📊</div>
          <div class="bi-empty-title">En attente des premiers achats boutique</div>
          <p class="bi-empty-desc">Les courbes de chiffre d'affaires mensuel et le volume de transactions Tebex se traceront et s'actualiseront automatiquement dès l'ouverture officielle de la boutique.</p>
        </div>
        <div class="bi-scrubber">
          <div class="bi-scrubber-fill"></div>
        </div>
      </div>

      <!-- Graphique 2 : Active Users MAU (Vide propre pré-lancement) -->
      <div class="bi-card-box">
        <div class="bi-card-head">
          <div>
            <h3>Active Users (MAU)</h3>
            <p>Joueurs uniques connectés au réseau sur chaque période de 30 jours</p>
          </div>
        </div>
        <div class="bi-empty-state">
          <div class="bi-empty-icon">👥</div>
          <div class="bi-empty-title">En attente des connexions de joueurs</div>
          <p class="bi-empty-desc">Les statistiques de joueurs uniques actifs (DAU / WAU / MAU) s'incrémenteront en direct dès l'ouverture des portes du serveur Minecraft.</p>
        </div>
        <div class="bi-scrubber">
          <div class="bi-scrubber-fill"></div>
        </div>
      </div>

      <!-- Grille 2 colonnes : Répartition Hostnames & Entonnoir Boutique -->
      <div class="bi-dual-grid">

        <!-- Répartition Hostnames -->
        <div class="bi-card-box">
          <div class="bi-card-head">
            <div>
              <h3>Repartition per Hostname</h3>
              <p>Origine des joueurs selon le sous-domaine de connexion</p>
            </div>
          </div>
          <table class="bi-table">
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
                  <td><span class="bi-hostname-badge">${h.nom}</span></td>
                  <td><b>—</b></td>
                  <td>0</td>
                  <td class="text-muted">0,00 €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Entonnoir Boutique (Funnel) -->
        <div class="bi-card-box">
          <div class="bi-card-head">
            <div>
              <h3>Entonnoir de Conversion Boutique</h3>
              <p>Parcours de navigation du visiteur jusqu'au panier validé</p>
            </div>
          </div>
          <div class="bi-funnel-list">
            ${d.funnel.map((f) => `
              <div class="bi-funnel-item">
                <div class="bi-funnel-label">${f.etape}</div>
                <div class="bi-funnel-track">
                  <svg width="100%" height="22">
                    <rect x="0" y="0" width="0" height="22" rx="4" fill="#00a3c4" />
                  </svg>
                </div>
                <div class="bi-funnel-stat">0% <span class="bi-funnel-sub">(0)</span></div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- Graphique Rétention Joueurs (Standards F2P) -->
      <div class="bi-card-box">
        <div class="bi-card-head">
          <div>
            <h3>Retentions D1/D7/D30 per day (Rolling 7D)</h3>
            <p>Objectifs de rétention cibles et comparaison industrie F2P</p>
          </div>
        </div>

        <div class="bi-chart-scroll">
          <svg viewBox="0 0 780 180" width="100%" height="180" preserveAspectRatio="xMidYMid meet">
            <!-- Lignes cibles benchmarks -->
            <line x1="30" y1="50" x2="750" y2="50" stroke="#00a3c4" stroke-dasharray="4" stroke-width="1.5" />
            <text x="752" y="54" fill="#00a3c4" font-size="10" font-weight="600">Target D1 (40%)</text>

            <line x1="30" y1="95" x2="750" y2="95" stroke="#334155" stroke-dasharray="4" stroke-width="1.5" />
            <text x="752" y="99" fill="#334155" font-size="10" font-weight="600">Target D7 (20%)</text>

            <line x1="30" y1="135" x2="750" y2="135" stroke="#10b981" stroke-dasharray="4" stroke-width="1.5" />
            <text x="752" y="139" fill="#10b981" font-size="10" font-weight="600">Target D30 (10%)</text>

            <!-- Axe X -->
            <line x1="30" y1="165" x2="750" y2="165" stroke="#cbd5e1" stroke-width="1" />
            <text x="30" y="177" fill="#94a3b8" font-size="10">Jour 1</text>
            <text x="170" y="177" fill="#94a3b8" font-size="10">Semaine 1</text>
            <text x="310" y="177" fill="#94a3b8" font-size="10">Mois 1</text>
            <text x="450" y="177" fill="#94a3b8" font-size="10">Mois 2</text>
            <text x="590" y="177" fill="#94a3b8" font-size="10">Mois 3</text>
            <text x="730" y="177" fill="#94a3b8" font-size="10">Lancement</text>
          </svg>
        </div>

        <div class="bi-retention-grid">
          <div class="bi-retention-card">
            <div class="bi-retention-top">Rétention D1 (J+1)</div>
            <div class="bi-retention-score">— <span class="bi-retention-target">Target: 40%</span></div>
            <p class="bi-retention-desc">Pourcentage des joueurs qui se reconnectent dès le lendemain de leur première partie.</p>
          </div>
          <div class="bi-retention-card">
            <div class="bi-retention-top">Rétention D7 (J+7)</div>
            <div class="bi-retention-score">— <span class="bi-retention-target">Target: 20%</span></div>
            <p class="bi-retention-desc">Joueurs toujours actifs après une semaine complète de jeu.</p>
          </div>
          <div class="bi-retention-card">
            <div class="bi-retention-top">Rétention D30 (J+30)</div>
            <div class="bi-retention-score">— <span class="bi-retention-target">Target: 10%</span></div>
            <p class="bi-retention-desc">Fidélité mensuelle à long terme (joueurs récurrents et acheteurs potentiels).</p>
          </div>
        </div>

        <div class="bi-note-benchmark">
          <b>Note :</b> Les valeurs cibles D1 (40%), D7 (20%) et D30 (10%) représentent les standards de l'industrie pour les jeux multijoueurs free-to-play à haute performance. Vos courbes réelles s'afficheront ici après les 24 premières heures d'activité des joueurs.
        </div>
      </div>

    </div>

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
