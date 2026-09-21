// Module Business Intelligence & Analytics pour OrbisMC
// Dashboard de suivi des indicateurs clés (SaaS Pro épuré 100% en Français)
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

// Données 100% réelles tirées de la base (aucune fausse donnée)
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
    hostnames: [
      { nom: 'play.mcorbis.com', desc: 'Connexions directes des joueurs' },
      { nom: 'tiktok.mcorbis.com', desc: 'Tracking liens créateurs TikTok' },
      { nom: 'youtube.mcorbis.com', desc: 'Tracking vidéos et sponsors YouTube' },
    ],
    funnel: [
      { etape: '1. Visiteurs uniques sur le site', nombre: 0, pct: 0, width: 0 },
      { etape: '2. Consultation de la boutique', nombre: 0, pct: 0, width: 0 },
      { etape: '3. Clic sur un grade ou des gemmes', nombre: 0, pct: 0, width: 0 },
      { etape: '4. Redirection vers le panier Tebex', nombre: 0, pct: 0, width: 0 },
      { etape: '5. Commandes validées (Acheteurs)', nombre: 0, pct: 0, width: 0 },
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
    <h1>Tableau de bord Orbis</h1>
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

// Tableau de bord complet de Business Intelligence (SVG pur, interactif, zéro fausse donnée)
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
<script src="/js/bi.js?v=${v}" defer></script>
</head>
<body class="bi-body">

<div class="bi-layout">

  <!-- Sidebar Filtres en Français -->
  <aside class="bi-sidebar">
    <div class="bi-sidebar-head">
      <h2>Filtres d'analyse</h2>
    </div>

    <div class="bi-filter-group">
      <label>Projet</label>
      <div class="bi-select-box">OrbisMC (Minecraft Java)</div>
    </div>

    <div class="bi-filter-group">
      <label>Période d'analyse</label>
      <div class="bi-select-box">Temps réel (En direct)</div>
    </div>

    <div class="bi-filter-group">
      <label>Pays ciblés</label>
      <div class="bi-select-box">France, Belgique, Suisse, Canada</div>
    </div>

    <div class="bi-filter-group">
      <label>Sous-domaines (Tracking)</label>
      <div class="bi-select-box">Tous les sous-domaines (3)</div>
    </div>

    <div class="bi-filter-group">
      <label>Segment d'acheteurs <span class="bi-info" title="Nouveaux vs Récurrents">ⓘ</span></label>
      <div class="bi-select-box">Tous les segments</div>
    </div>

    <div class="bi-filter-group">
      <label>Temps de jeu <span class="bi-info" title="Heures passées sur le réseau">ⓘ</span></label>
      <div class="bi-select-box">Toutes durées confondues</div>
    </div>

    <div class="bi-filter-group">
      <label>Inactivité (jours) <span class="bi-info" title="Délai depuis la dernière connexion">ⓘ</span></label>
      <div class="bi-range-track">
        <div class="bi-range-bar"></div>
        <div class="bi-range-handle"></div>
      </div>
      <div class="bi-range-label">0 - 30 jours</div>
    </div>

    <div class="bi-filter-group">
      <label>Plateforme de jeu</label>
      <div class="bi-select-box">Java Edition (1.21 à 26.2)</div>
    </div>

    <div class="bi-filter-actions">
      <button type="button" class="bi-btn-filter">Appliquer les filtres</button>
      <button type="button" class="bi-btn-clear">Réinitialiser</button>
    </div>
  </aside>

  <!-- Zone Principale -->
  <main class="bi-main">

    <!-- Topbar épurée avec onglets cliquables -->
    <header class="bi-topbar">
      <div class="bi-topbar-left">
        <div class="bi-title-row">
          <h1>Tableau de bord</h1>
          <span class="bi-star">★</span>
          <span class="bi-refresh-icon">↻</span>
          <span class="bi-status-dot"></span>
          <span class="bi-time-badge">${d.dbActive ? 'Base de données connectée' : 'Mode pré-lancement'}</span>
        </div>
        <nav class="bi-tabs-main">
          <a href="#overview" class="bi-tab-main active" data-bi-tab="tab-overview">Vue d'ensemble</a>
          <a href="#features" class="bi-tab-main" data-bi-tab="tab-features">Fonctionnalités</a>
          <a href="#docs" class="bi-tab-main" data-bi-tab="tab-docs">Documentation & Rachat</a>
        </nav>
      </div>
      <div class="bi-topbar-right">
        <a href="/bi-analytics-9834x?deconnexion=1" class="bi-btn-logout">Déconnexion</a>
      </div>
    </header>

    <div class="bi-content">

      <!-- =============================================================== ONGLET 1 : VUE D'ENSEMBLE =============================================================== -->
      <section id="tab-overview" class="bi-view active">

        <!-- Sous-navigation (Ventes & Métriques) -->
        <div class="bi-subnav-row">
          <div class="bi-subtabs">
            <span class="bi-subtab" data-bi-subtab="jour">Ventes par jour</span>
            <span class="bi-subtab" data-bi-subtab="semaine">Ventes par semaine</span>
            <span class="bi-subtab active" data-bi-subtab="mois">Ventes par mois</span>
            <span class="bi-subtab" data-bi-subtab="reachat">Fidélité & Réachats</span>
            <span class="bi-subtab" data-bi-subtab="tebex">Frais & Taxes Tebex</span>
          </div>
        </div>

        <div class="bi-subnav-row">
          <div class="bi-pills">
            <span class="bi-pill" data-bi-pill="pays">Par Pays</span>
            <span class="bi-pill active" data-bi-pill="host">Par Sous-domaine</span>
            <span class="bi-pill" data-bi-pill="segment">Par Segment Joueur</span>
            <span class="bi-pill" data-bi-pill="temps">Par Temps de jeu</span>
            <span class="bi-pill" data-bi-pill="tebex-art">Par Article Tebex</span>
            <span class="bi-pill" data-bi-pill="jeu-art">Par Objet en jeu</span>
            <span class="bi-pill" data-bi-pill="arppu">Par Panier moyen</span>
            <span class="bi-pill" data-bi-pill="taux">Par Taux d'achat</span>
          </div>
        </div>

        <!-- Cartes KPI (100% réelles, zéro fausse donnée) -->
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
            <div class="bi-kpi-foot">Données multijoueur réelles</div>
          </div>
        </div>

        <!-- Graphique 1 : Revenue & sale volume -->
        <div class="bi-card-box">
          <div class="bi-card-head">
            <div>
              <h3>Revenus & Volume de Ventes Mensuel (€)</h3>
              <p>Chiffre d'affaires mensuel net (€) et volume d'acheteurs uniques</p>
            </div>
          </div>
          <div class="bi-empty-state">
            <div class="bi-empty-icon">📊</div>
            <div class="bi-empty-title">En attente des premiers achats boutique</div>
            <p class="bi-empty-desc">Les courbes de chiffre d'affaires mensuel et le volume de transactions Tebex se traceront et s'actualiseront automatiquement en direct dès l'ouverture officielle de la boutique.</p>
          </div>
          <div class="bi-scrubber">
            <div class="bi-scrubber-fill"></div>
          </div>
        </div>

        <!-- Graphique 2 : Active Users MAU -->
        <div class="bi-card-box">
          <div class="bi-card-head">
            <div>
              <h3>Utilisateurs Mensuels Actifs (MAU)</h3>
              <p>Joueurs uniques connectés au réseau sur chaque période de 30 jours</p>
            </div>
          </div>
          <div class="bi-empty-state">
            <div class="bi-empty-icon">👥</div>
            <div class="bi-empty-title">En attente de l'ouverture du serveur</div>
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
                <h3>Répartition par Sous-domaine (Hostnames)</h3>
                <p>Origine des joueurs selon le domaine de connexion utilisé</p>
              </div>
            </div>
            <table class="bi-table">
              <thead>
                <tr>
                  <th>Sous-domaine</th>
                  <th>Description</th>
                  <th>Joueurs</th>
                  <th>CA Généré</th>
                </tr>
              </thead>
              <tbody>
                ${d.hostnames.map((h) => `
                  <tr>
                    <td><span class="bi-hostname-badge">${h.nom}</span></td>
                    <td>${h.desc}</td>
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

        <!-- Graphique Rétention Joueurs -->
        <div class="bi-card-box">
          <div class="bi-card-head">
            <div>
              <h3>Rétention Joueurs J+1 / J+7 / J+30 (Rolling 7D)</h3>
              <p>Objectifs de rétention cibles et comparaison avec les standards de l'industrie F2P</p>
            </div>
          </div>

          <div class="bi-chart-scroll">
            <svg viewBox="0 0 780 180" width="100%" height="180" preserveAspectRatio="xMidYMid meet">
              <!-- Lignes cibles benchmarks -->
              <line x1="30" y1="50" x2="750" y2="50" stroke="#00a3c4" stroke-dasharray="4" stroke-width="1.5" />
              <text x="752" y="54" fill="#00a3c4" font-size="10" font-weight="600">Cible D1 (40%)</text>

              <line x1="30" y1="95" x2="750" y2="95" stroke="#334155" stroke-dasharray="4" stroke-width="1.5" />
              <text x="752" y="99" fill="#334155" font-size="10" font-weight="600">Cible D7 (20%)</text>

              <line x1="30" y1="135" x2="750" y2="135" stroke="#10b981" stroke-dasharray="4" stroke-width="1.5" />
              <text x="752" y="139" fill="#10b981" font-size="10" font-weight="600">Cible D30 (10%)</text>

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
              <div class="bi-retention-score">— <span class="bi-retention-target">Cible : 40%</span></div>
              <p class="bi-retention-desc">Pourcentage des joueurs qui se reconnectent dès le lendemain de leur première partie.</p>
            </div>
            <div class="bi-retention-card">
              <div class="bi-retention-top">Rétention D7 (J+7)</div>
              <div class="bi-retention-score">— <span class="bi-retention-target">Cible : 20%</span></div>
              <p class="bi-retention-desc">Joueurs toujours fidèles et actifs après une semaine complète de jeu.</p>
            </div>
            <div class="bi-retention-card">
              <div class="bi-retention-top">Rétention D30 (J+30)</div>
              <div class="bi-retention-score">— <span class="bi-retention-target">Cible : 10%</span></div>
              <p class="bi-retention-desc">Fidélité mensuelle à long terme (joueurs récurrents et acheteurs potentiels).</p>
            </div>
          </div>

          <div class="bi-note-benchmark">
            <b>Note d'analyse :</b> Les valeurs cibles D1 (40%), D7 (20%) et D30 (10%) représentent les standards de l'industrie pour les jeux multijoueurs free-to-play à haute performance. Vos courbes réelles s'afficheront ici après les 24 premières heures d'activité des joueurs.
          </div>
        </div>

      </section>

      <!-- =============================================================== ONGLET 2 : FONCTIONNALITÉS =============================================================== -->
      <section id="tab-features" class="bi-view">

        <div class="bi-card-box">
          <div class="bi-card-head">
            <div>
              <h3>Inventaire des fonctionnalités & Architecture du Réseau</h3>
              <p>Panorama complet des systèmes développés et déployés sur OrbisMC</p>
            </div>
            <span class="bi-feature-badge bi-badge-green">✔ Système Opérationnel</span>
          </div>

          <div class="bi-feature-grid">

            <div class="bi-feature-card">
              <span class="bi-feature-badge bi-badge-blue">Mode de Jeu #1</span>
              <h4>Tower Defense</h4>
              <p>Arène compétitive stratégique avec vagues infinies et système de match ELO.</p>
              <ul class="bi-feature-list">
                <li>Classement ELO en direct et records de vagues</li>
                <li>Tours élémentaires & monstres personnalisés</li>
                <li>Équilibrage compétitif sans avantage Pay-to-Win</li>
              </ul>
            </div>

            <div class="bi-feature-card">
              <span class="bi-feature-badge bi-badge-amber">Mode de Jeu #2</span>
              <h4>Extraction (Lethal)</h4>
              <p>Mode survie sous pression inspiré de Lethal Company.</p>
              <ul class="bi-feature-list">
                <li>Quotas de ferraille à remplir en équipe</li>
                <li>Monstres nocturnes et zones radioactives</li>
                <li>Vaisseau d'extraction avec compte à rebours</li>
              </ul>
            </div>

            <div class="bi-feature-card">
              <span class="bi-feature-badge bi-badge-purple">Mode de Jeu #3</span>
              <h4>Donjon MMORPG</h4>
              <p>Aventure coopérative de 1 à 4 joueurs avec boss et récompenses épiques.</p>
              <ul class="bi-feature-list">
                <li>12 étages progressifs avec salles d'énigmes</li>
                <li>Boss de fin avec phases et attaques de zone</li>
                <li>Loots exclusifs, clés de coffre et gemmes</li>
              </ul>
            </div>

            <div class="bi-feature-card">
              <span class="bi-feature-badge bi-badge-green">Mode de Jeu #4</span>
              <h4>1 vs 1 (Duels Rapides)</h4>
              <p>Duels intenses et nerveux en arène fermée.</p>
              <ul class="bi-feature-list">
                <li>Défis aléatoires chronométrés</li>
                <li>Kits équilibrés pour chaque match</li>
                <li>Historique des victoires et classement ELO</li>
              </ul>
            </div>

            <div class="bi-feature-card">
              <span class="bi-feature-badge bi-badge-blue">Économie Globale</span>
              <h4>Système de Gemmes & Boutique</h4>
              <p>Monétisation saine et conforme à l'EULA Mojang.</p>
              <ul class="bi-feature-list">
                <li>Monnaie virtuelle unique (Gemmes) partagée sur tout le réseau</li>
                <li>Grades VIP, Élite et Légende avec cosmétiques exclusifs</li>
                <li>Coffres quotidiens, clés de vote et récompenses d'assiduité</li>
              </ul>
            </div>

            <div class="bi-feature-card">
              <span class="bi-feature-badge bi-badge-purple">Moteur Visuel</span>
              <h4>Cosmétiques & UltraCosmetics</h4>
              <p>Personnalisation graphique complète sans aucun mod à installer.</p>
              <ul class="bi-feature-list">
                <li>Traînées de particules, effets de mort et traits de flèche</li>
                <li>Chapeaux texturés 3D et familiers interactifs</li>
                <li>Commandes de prévisualisation : /testcosmetique</li>
              </ul>
            </div>

          </div>
        </div>

      </section>

      <!-- =============================================================== ONGLET 3 : DOCUMENTATION & RACHAT =============================================================== -->
      <section id="tab-docs" class="bi-view">

        <div class="bi-doc-card">
          <h3>📈 1. Guide de Valorisation d'un Serveur Minecraft (Formule Fuze / PokeIsland)</h3>
          <p>Dans l'industrie du jeu vidéo indépendant et des serveurs Minecraft, la valeur marchande d'un réseau repose sur des indicateurs vérifiables présentés dans ce dashboard :</p>
          <div class="bi-callout-info">
            <b>Formule clé de valorisation :</b><br>
            • <b>ARR (Revenu Annuel Récurrent) :</b> CA mensuel moyen × 12 mois.<br>
            • <b>Multiple de valorisation :</b> Un serveur sain avec une rétention J+1 > 35% et un taux de réachat > 30% se valorise entre <b>1.5x et 2.5x son CA annuel</b>.<br>
            • <b>LTV (Lifetime Value) :</b> Montant total moyen dépensé par un joueur tout au long de sa présence sur le serveur.
          </div>
        </div>

        <div class="bi-doc-card">
          <h3>🌐 2. Configuration du Tracking par Sous-Domaine (Hostnames)</h3>
          <p>Pour mesurer avec précision l'efficacité de vos créateurs de contenu et sponsors (YouTube, TikTok, Instagram) :</p>
          <div class="bi-code-box">
            # Enregistrements DNS CNAME à créer chez votre registraire (OVH / Hostinger / Cloudflare) :<br>
            tiktok.mcorbis.com.    CNAME    play.mcorbis.com.<br>
            youtube.mcorbis.com.   CNAME    play.mcorbis.com.<br>
            partenaire.mcorbis.com. CNAME    play.mcorbis.com.
          </div>
          <p>Le proxy Velocity enregistre automatiquement le domaine utilisé par chaque joueur lors du handshake et incrémente le tableau de répartition en direct.</p>
        </div>

        <div class="bi-doc-card">
          <h3>💳 3. Liaison de l'API Tebex (Passerelle de Paiement)</h3>
          <p>Dès que le serveur VPS sera configuré, la liaison avec Tebex s'effectue simplement via les variables d'environnement :</p>
          <div class="bi-code-box">
            TEBEX_JETON="votre_cle_api_secrete_tebex"<br>
            SERVEUR_OUVERT="true"<br>
            ADRESSE_JEU="play.mcorbis.com"
          </div>
          <p>L'IPN (Instant Payment Notification) délivre instantanément les gemmes et grades en jeu en moins de 2 secondes après le paiement par CB ou PayPal.</p>
        </div>

        <div class="bi-doc-card">
          <h3>🔐 4. Procédure de Sauvegarde & Restitution de la Data Room</h3>
          <p>Pour auditer ou transférer la propriété du projet à un tiers :</p>
          <ul class="bi-feature-list">
            <li><b>Base de données :</b> Export complet MariaDB avec la commande <code>mysqldump -u serv_web -p serv > backup_orbis.sql</code></li>
            <li><b>Code source :</b> Dépôt Git privé avec tout le code des plugins Java et du site Vercel.</li>
            <li><b>Nom de domaine :</b> Transfert du domaine <code>mcorbis.com</code> en 1 clic vers le compte de votre choix.</li>
          </ul>
        </div>

      </section>

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
