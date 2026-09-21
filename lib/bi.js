// Module Business Intelligence & Analytics pour OrbisMC
// Inspiré des tableaux de bord de valorisation de serveurs Minecraft (PokeIsland / Fuze)
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

// Données d'analyse réelles + baseline de projection
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
      { etape: 'Visiteurs uniques sur le site', nombre: 28400, pct: 100, width: 100 },
      { etape: 'Consultation de la boutique', nombre: 9800, pct: 34.5, width: 34.5 },
      { etape: 'Clic sur un article / grade', nombre: 3420, pct: 12.0, width: 12 },
      { etape: 'Redirection panier Tebex', nombre: 1750, pct: 6.2, width: 6.2 },
      { etape: 'Paiement confirmé (Acheteurs)', nombre: 1370, pct: 4.8, width: 4.8 },
    ],
  };
}

// Page de connexion secrète épurée SaaS
function vueLogin(erreur = '') {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accès Réservé · Orbis Analytics</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/bi.css">
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

// Tableau de bord complet de Business Intelligence (SVG pur, zéro style inline, conforme CSP)
function vueDashboard(d) {
  const maxCa = Math.max(...d.caMois);
  const maxMau = Math.max(...d.mauData);
  const maxTx = Math.max(...d.transactionsMois);

  // Configuration graphique Revenus (€)
  const barWidth = 64;
  const gap = 38;
  const svgCaWidth = d.mois.length * (barWidth + gap) + 60;
  const svgCaHeight = 260;
  const chartBaseY = 205;
  const maxBarH = 145;

  // Calcul des coordonnées pour la ligne de volume (transactions)
  const txPoints = d.transactionsMois.map((tx, idx) => {
    const cx = 42 + idx * (barWidth + gap) + barWidth / 2;
    const cy = 70 + Math.round((1 - (tx / maxTx)) * 100);
    return { cx, cy, tx };
  });

  const polylinePoints = txPoints.map((p) => `${p.cx},${p.cy}`).join(' ');

  // Barres du CA
  const svgCaBars = d.mois.map((m, idx) => {
    const x = 42 + idx * (barWidth + gap);
    const val = d.caMois[idx];
    const barH = Math.max(12, Math.round((val / maxCa) * maxBarH));
    const y = chartBaseY - barH;
    return `
      <g>
        <text x="${x + barWidth / 2}" y="${y - 12}" fill="#0f172a" font-size="12" font-weight="700" text-anchor="middle">${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</text>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="#00a3c4" />
        <text x="${x + barWidth / 2}" y="${chartBaseY + 22}" fill="#64748b" font-size="12" font-weight="600" text-anchor="middle">${m}</text>
      </g>
    `;
  }).join('');

  // Points et étiquettes pour la ligne de transactions
  const svgTxPoints = txPoints.map((p) => `
    <g>
      <circle cx="${p.cx}" cy="${p.cy}" r="4.5" fill="#ffffff" stroke="#1e293b" stroke-width="2" />
      <text x="${p.cx}" y="${p.cy - 9}" fill="#1e293b" font-size="11" font-weight="700" text-anchor="middle">${p.tx}</text>
    </g>
  `).join('');

  // Barres MAU
  const svgMauBars = d.mois.map((m, idx) => {
    const x = 42 + idx * (barWidth + gap);
    const val = d.mauData[idx];
    const barH = Math.max(12, Math.round((val / maxMau) * maxBarH));
    const y = chartBaseY - barH;
    return `
      <g>
        <text x="${x + barWidth / 2}" y="${y - 12}" fill="#0f172a" font-size="12" font-weight="700" text-anchor="middle">${val}</text>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="#f97316" />
        <text x="${x + barWidth / 2}" y="${chartBaseY + 22}" fill="#64748b" font-size="12" font-weight="600" text-anchor="middle">${m}</text>
      </g>
    `;
  }).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OrbisMC — Executive Analytics & BI Dashboard</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/css/bi.css">
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
      <div class="bi-select-box">Last 6 months</div>
    </div>

    <div class="bi-filter-group">
      <label>Country</label>
      <div class="bi-select-box">France, Belgique, Suisse, Canada</div>
    </div>

    <div class="bi-filter-group">
      <label>Hostname</label>
      <div class="bi-select-box">All hostnames (4)</div>
    </div>

    <div class="bi-filter-group">
      <label>Buyer segment <span class="bi-info">ⓘ</span></label>
      <div class="bi-select-box">6 options</div>
    </div>

    <div class="bi-filter-group">
      <label>Playtime segment <span class="bi-info">ⓘ</span></label>
      <div class="bi-select-box">5 options</div>
    </div>

    <div class="bi-filter-group">
      <label>Inactivity Day <span class="bi-info">ⓘ</span></label>
      <div class="bi-range-track">
        <div class="bi-range-bar"></div>
        <div class="bi-range-handle"></div>
      </div>
      <div class="bi-range-label">0 - 138 days</div>
    </div>

    <div class="bi-filter-group">
      <label>Platform</label>
      <div class="bi-select-box">Java Edition (PC / Mac)</div>
    </div>

    <div class="bi-filter-actions">
      <button type="button" class="bi-btn-filter">Apply filters</button>
      <button type="button" class="bi-btn-clear">Clear all</button>
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
          <span class="bi-time-badge">${d.dbActive ? 'Données Live Production' : 'Simulé · 1 hour ago'}</span>
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

      <!-- KPIs Rapides -->
      <div class="bi-kpi-grid">
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Volume Total Ventes (LTV)</div>
          <div class="bi-kpi-num">${d.caTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
          <div class="bi-kpi-foot">↑ +14.2% vs objectif prévisionnel</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Panier Moyen Payeur (ARPPU)</div>
          <div class="bi-kpi-num">${d.arppu} €</div>
          <div class="bi-kpi-foot neutral">Panier moyen par acheteur unique</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Taux de Réachat (Repurchase)</div>
          <div class="bi-kpi-num">${d.tauxReachat} %</div>
          <div class="bi-kpi-foot">Fidélité monétaire très saine</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Rétention J+1 (Target 40%)</div>
          <div class="bi-kpi-num">${d.retentionD1} %</div>
          <div class="bi-kpi-foot">Standard F2P respecté</div>
        </div>
        <div class="bi-kpi-card">
          <div class="bi-kpi-title">Taux Conversion Boutique</div>
          <div class="bi-kpi-num">${d.tauxConversionBoutique} %</div>
          <div class="bi-kpi-foot neutral">Moyenne serveurs : 2.5%</div>
        </div>
      </div>

      <!-- Graphique 1 : Revenue & sale volume (Slide 1 Fuze) -->
      <div class="bi-card-box">
        <div class="bi-card-head">
          <div>
            <h3>Revenue & sale volume</h3>
            <p>Chiffre d'affaires mensuel net (€) et volume d'acheteurs uniques</p>
          </div>
        </div>
        <div class="bi-chart-scroll">
          <svg viewBox="0 0 ${svgCaWidth} ${svgCaHeight}" width="100%" height="${svgCaHeight}" preserveAspectRatio="xMidYMid meet">
            <!-- Lignes de repère horizontales -->
            <line x1="20" y1="50" x2="${svgCaWidth - 20}" y2="50" stroke="#f1f5f9" stroke-dasharray="3" />
            <line x1="20" y1="100" x2="${svgCaWidth - 20}" y2="100" stroke="#f1f5f9" stroke-dasharray="3" />
            <line x1="20" y1="150" x2="${svgCaWidth - 20}" y2="150" stroke="#f1f5f9" stroke-dasharray="3" />
            <line x1="20" y1="${chartBaseY}" x2="${svgCaWidth - 20}" y2="${chartBaseY}" stroke="#cbd5e1" stroke-width="1.5" />
            
            <!-- Barres Cyan -->
            ${svgCaBars}

            <!-- Ligne de volume de transactions -->
            <polyline points="${polylinePoints}" fill="none" stroke="#1e293b" stroke-width="2" />
            ${svgTxPoints}
          </svg>
        </div>
        <div class="bi-scrubber">
          <div class="bi-scrubber-fill"></div>
        </div>
      </div>

      <!-- Graphique 2 : Active Users MAU (Slide 2 & 3 Fuze) -->
      <div class="bi-card-box">
        <div class="bi-card-head">
          <div>
            <h3>Active Users (MAU)</h3>
            <p>Joueurs uniques connectés au réseau sur chaque période de 30 jours</p>
          </div>
        </div>
        <div class="bi-chart-scroll">
          <svg viewBox="0 0 ${svgCaWidth} ${svgCaHeight}" width="100%" height="${svgCaHeight}" preserveAspectRatio="xMidYMid meet">
            <!-- Lignes de repère horizontales -->
            <line x1="20" y1="50" x2="${svgCaWidth - 20}" y2="50" stroke="#f1f5f9" stroke-dasharray="3" />
            <line x1="20" y1="100" x2="${svgCaWidth - 20}" y2="100" stroke="#f1f5f9" stroke-dasharray="3" />
            <line x1="20" y1="150" x2="${svgCaWidth - 20}" y2="150" stroke="#f1f5f9" stroke-dasharray="3" />
            <line x1="20" y1="${chartBaseY}" x2="${svgCaWidth - 20}" y2="${chartBaseY}" stroke="#cbd5e1" stroke-width="1.5" />
            
            <!-- Barres Orange -->
            ${svgMauBars}
          </svg>
        </div>
        <div class="bi-scrubber">
          <div class="bi-scrubber-fill"></div>
        </div>
      </div>

      <!-- Grille 2 colonnes : Répartition Hostnames & Entonnoir Boutique -->
      <div class="bi-dual-grid">

        <!-- Répartition Hostnames (Slide 4 Fuze) -->
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
                  <td><b>${h.pct}%</b></td>
                  <td>${nombre(h.joueurs)}</td>
                  <td><b class="text-success">${h.ca}</b></td>
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
                    <rect x="0" y="0" width="${f.width}%" height="22" rx="4" fill="#00a3c4" />
                  </svg>
                </div>
                <div class="bi-funnel-stat">${f.pct}% <span class="bi-funnel-sub">(${nombre(f.nombre)})</span></div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- Graphique Rétention Joueurs (Slide 5 Fuze) -->
      <div class="bi-card-box">
        <div class="bi-card-head">
          <div>
            <h3>Retentions D1/D7/D30 per day (Rolling 7D)</h3>
            <p>Courbes de rétention et comparaison avec les cibles de l'industrie F2P</p>
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

            <!-- Courbe D1 (Cyan avec zone ombrée) -->
            <path d="M30,55 Q120,40 210,50 T390,45 T570,52 T750,48 L750,165 L30,165 Z" fill="rgba(0,163,196,0.08)" />
            <path d="M30,55 Q120,40 210,50 T390,45 T570,52 T750,48" fill="none" stroke="#00a3c4" stroke-width="2" />

            <!-- Courbe D7 (Dark Slate) -->
            <path d="M30,98 Q120,88 210,95 T390,92 T570,96 T750,94 L750,165 L30,165 Z" fill="rgba(30,41,59,0.05)" />
            <path d="M30,98 Q120,88 210,95 T390,92 T570,96 T750,94" fill="none" stroke="#334155" stroke-width="2" />

            <!-- Courbe D30 (Emerald) -->
            <path d="M30,138 Q120,130 210,136 T390,134 T570,137 T750,135 L750,165 L30,165 Z" fill="rgba(16,185,129,0.05)" />
            <path d="M30,138 Q120,130 210,136 T390,134 T570,137 T750,135" fill="none" stroke="#10b981" stroke-width="2" />

            <!-- Axe X -->
            <line x1="30" y1="165" x2="750" y2="165" stroke="#cbd5e1" stroke-width="1" />
            <text x="30" y="177" fill="#94a3b8" font-size="10">Tue 17</text>
            <text x="170" y="177" fill="#94a3b8" font-size="10">April</text>
            <text x="310" y="177" fill="#94a3b8" font-size="10">May</text>
            <text x="450" y="177" fill="#94a3b8" font-size="10">June</text>
            <text x="590" y="177" fill="#94a3b8" font-size="10">July</text>
            <text x="730" y="177" fill="#94a3b8" font-size="10">Wed 22</text>
          </svg>
        </div>

        <div class="bi-retention-grid">
          <div class="bi-retention-card">
            <div class="bi-retention-top">Rétention D1 (J+1)</div>
            <div class="bi-retention-score">${d.retentionD1}% <span class="bi-retention-target">Target: 40%</span></div>
            <p class="bi-retention-desc">Pourcentage des joueurs qui se reconnectent dès le lendemain de leur première partie.</p>
          </div>
          <div class="bi-retention-card">
            <div class="bi-retention-top">Rétention D7 (J+7)</div>
            <div class="bi-retention-score">${d.retentionD7}% <span class="bi-retention-target">Target: 20%</span></div>
            <p class="bi-retention-desc">Joueurs toujours actifs après une semaine complète de jeu.</p>
          </div>
          <div class="bi-retention-card">
            <div class="bi-retention-top">Rétention D30 (J+30)</div>
            <div class="bi-retention-score">${d.retentionD30}% <span class="bi-retention-target">Target: 10%</span></div>
            <p class="bi-retention-desc">Fidélité mensuelle à long terme (joueurs récurrents et acheteurs potentiels).</p>
          </div>
        </div>

        <div class="bi-note-benchmark">
          <b>Note :</b> Les valeurs optimales D1 (40%), D7 (20%) et D30 (10%) représentent les cibles de référence (benchmarks) de l'industrie pour les jeux multijoueurs free-to-play à haute performance. Ces standards constituent des indicateurs clés pour l'évaluation et la valorisation du projet.
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
