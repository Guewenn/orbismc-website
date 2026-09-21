// Les pages du site. Tout ce qui vient de la base ou du visiteur passe par esc() (ou mm.span, qui échappe aussi).
// Aucun style en ligne : la politique de sécurité l'interdit, tout est dans /css/site.css.
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { esc, nombre, duree, date } = require('./html');
const mm = require('./mm');
const { NOMS_GRADES } = require('./donnees');
const seo = require('./seo');
const { lienSur } = require('./securite');

// Lien Discord de la configuration, accepté seulement en https.
const DISCORD = lienSur(config.discord);

// Messages affichés après une action : l'adresse ne transporte qu'un code, jamais un texte libre.
const MESSAGES = {
  ok: {
    achat: 'Acheté et équipé. Visible à ta prochaine arrivée sur un serveur.',
    equipe: 'Équipé. Visible à ta prochaine arrivée sur un serveur.',
    merci: 'Merci pour ton soutien ! Tes gemmes arrivent sur ton compte dans la minute.',
  },
  erreur: {
    inconnu: 'Cet article est introuvable.',
    offert: 'Cet article est offert avec un grade : il ne se vend pas.',
    en_jeu: "Cet article s'achète en jouant, pas en gemmes.",
    deja: 'Tu possèdes déjà cet article.',
    gemmes: 'Pas assez de gemmes.',
    pas_a_toi: 'Tu ne possèdes pas cet article.',
    offre: 'Offre inconnue.',
    paiement: 'Le paiement est indisponible pour le moment. Réessaie plus tard.',
  },
};
const messageOk = (code) => (Object.hasOwn(MESSAGES.ok, code) ? MESSAGES.ok[code] : '');
const messageErreur = (code) => (Object.hasOwn(MESSAGES.erreur, code) ? MESSAGES.erreur[code] : '');

const NOM = config.nomServeur;
const IMG = path.join(__dirname, '..', 'public', 'img');
const VID = path.join(__dirname, '..', 'public', 'videos');
const i = (nom) => (fs.existsSync(path.join(IMG, 'icones', `${nom}.svg`)) ? `/img/icones/${nom}.svg` : `/img/icones/${nom}.png`);
// Version des fichiers statiques (date de modification) : un changement de CSS ou de JS est pris tout de suite.
const version = (fichier) => {
  try {
    return Math.floor(fs.statSync(path.join(__dirname, '..', 'public', fichier)).mtimeMs).toString(36);
  } catch {
    return '0';
  }
};
const APERCUS = require('./apercus.json');
const V_APERCUS = version('css/apercus.css');
const V_CSS = version('css/site.css'), V_JS = version('js/site.js'), V_SCENE = version('img/scene.svg');

// Une vraie image déposée dans public/img remplace automatiquement le dessin par défaut.
function image(nom, defaut) {
  for (const ext of ['webp', 'jpg', 'png', 'svg']) {
    const rel = `img/${nom}.${ext}`;
    if (fs.existsSync(path.join(IMG, `${nom}.${ext}`))) return `/${rel}?v=${version(rel)}`;
  }
  if (defaut) {
    const propre = defaut.split('?')[0];
    const rel = propre.startsWith('/') ? propre.slice(1) : propre;
    return `${propre}?v=${version(rel)}`;
  }
  return defaut;
}

// Captures d'écran d'un jeu : public/img/captures/<id>-1.jpg, <id>-2.jpg…
function captures(id) {
  try {
    return fs.readdirSync(path.join(IMG, 'captures'))
      .filter((f) => f.startsWith(`${id}-`) && /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
      .map((f) => `/img/captures/${encodeURIComponent(f)}`);
  } catch {
    return [];
  }
}

// Catalogue en mémoire (rempli par le serveur au démarrage) pour afficher couleurs et titres.
let CATALOGUE = new Map();
function definirCatalogue(liste) {
  CATALOGUE = new Map(liste.map((c) => [c.id, c]));
}
function catalogueValeur(id) {
  return (CATALOGUE.get(id) || {}).valeur || '';
}
function titre(id) {
  if (!id || !CATALOGUE.has(id)) return '';
  return ` ${mm.span(id, catalogueValeur(id))}`;
}
function nomColore(l) {
  return l.couleur ? mm.span(l.couleur, catalogueValeur(l.couleur), l.pseudo) : esc(l.pseudo);
}
function tete(pseudo) {
  return `<span class="tete" aria-hidden="true">${esc(String(pseudo || '?')[0].toUpperCase())}</span>`;
}
function lienJoueur(l) {
  return `<a class="joueur-ligne" href="/joueur/${encodeURIComponent(l.pseudo)}">${tete(l.pseudo)}<span>${nomColore(l)}</span></a>`;
}

// ------------------------------------------------------------------ les jeux

const JEUX = {
  td: {
    num: '01', nom: 'Tower Defense', court: 'Ta base, tes tours, tes raids.', accroche: 'Construis. Mine. Défends. Attaque.',
    texte: "Chaque joueur reçoit son île. Trace le chemin des monstres, pose et améliore tes tours, descends miner à la Carrière pour en débloquer de nouvelles, puis lance tes troupes à l'assaut des bases des autres joueurs, même quand ils dorment.",
    points: ['9 tours et 14 monstres, du Zombie au Titan', 'La Carrière : un puits de minage partagé pour débloquer tes tours', 'Arène classée : tu déploies toi-même tes troupes et tes sorts', "L'Upgrader, la Forge et le Prestige pour aller toujours plus loin"],
    badges: [['golden_sword', '9 tours'], ['tnt', '14 monstres'], ['diamond_pickaxe', 'La Carrière']],
    fonctions: [
      ['shield', 'Neuf tours', 'Archer, Canon, Glace, Feu, Tesla, Sniper, Mortier, Poison et Radar, chacune jusqu’au niveau V.'],
      ['tnt', 'Quatorze monstres', 'Volants, invisibles, soigneuses, nécromanciens… et un Titan toutes les 25 vagues.'],
      ['diamond_pickaxe', 'La Carrière', 'Un puits de minage partagé : plus tu creuses, plus c’est rare. Les ressources débloquent tes tours.'],
      ['golden_sword', 'L’arène', 'Attaque les autres bases : déploie tes troupes, lance Rage, Soin ou Gel, vole leur butin.'],
      ['experience_bottle', 'Upgrader et Élixirs', 'Tente ta chance pour une tour ou un bonus… au risque d’un malus.'],
      ['nether_star', 'Le Prestige', 'Passé la vague 250, recommence avec un bonus permanent.'],
    ],
    classements: [['td_elo', 'Arène ELO', (v) => nombre(v)], ['td_record', 'Record de vague', (v) => `vague ${nombre(v)}`], ['td_raids_gagnes', 'Raids gagnés', (v) => nombre(v)]],
  },
  lethal: {
    num: '02', nom: 'Extraction', court: 'Ramène la ferraille. Vivant.', accroche: 'Ramène la ferraille. Vivant.',
    texte: "Ton équipage atterrit sur une lune générée à chaque partie. Le complexe est plongé dans le noir, ta lampe s'épuise, et quelque chose bouge quand tu ne regardes pas. Le vaisseau décolle à minuit, avec ou sans toi.",
    points: ['Escouades de 1 à 4, avec salon privé et remplissage automatique', 'Des lunes et des complexes différents à chaque atterrissage', 'Un quota à tenir tous les trois jours, sinon c’est le renvoi', 'Une lampe torche, un scanner et le son comme seules armes'],
    badges: [['lantern', 'Dans le noir'], ['compass', 'Lunes générées'], ['clock', 'Décollage à minuit']],
    fonctions: [
      ['lantern', 'Le noir complet', 'Ta lampe torche et ta pile sont tout ce qui te sépare de ce qui rôde.'],
      ['compass', 'Des lunes générées', 'Jamais deux fois le même complexe : il faut explorer, écouter, cartographier.'],
      ['ender_eye', 'Des créatures', 'Certaines chassent au bruit, d’autres quand tu tournes le dos.'],
      ['clock', 'Le quota', 'Tous les trois jours, l’équipage doit avoir rapporté assez de ferraille.'],
      ['firework_rocket', 'En escouade', 'Jusqu’à quatre, on se couvre, on se partage la charge, on revient ensemble.'],
      ['tnt', 'Du matériel', 'Grenades, piles, scanner : à acheter entre deux atterrissages.'],
    ],
    classements: [['lethal_quotas', 'Quotas tenus', (v) => nombre(v)], ['lethal_ferraille', 'Ferraille rapportée', (v) => `${nombre(v)} ₵`], ['lethal_jours', 'Journées survécues', (v) => nombre(v)]],
  },
  donjon: {
    num: '03', nom: 'Donjon', court: 'Jusqu’à 4. Douze niveaux. Un roi.', accroche: 'Jusqu’à 4. Douze niveaux. Un roi.',
    texte: 'Forme ton escouade, choisis ta classe et descends. Douze niveaux générés à chaque partie, des pièges, des embuscades, des Âmes à gagner sur chaque monstre et à dépenser à la Forge. Et au fond, le Roi-Liche.',
    points: ['Cinq classes : Chevalier, Archère, Mage, Gladiateur, Soigneur', 'Douze niveaux générés : Cryptes, Mines oubliées, Forteresse infernale', 'Les Âmes : gagnées en combattant, dépensées à la Forge de ta classe', 'Champions, pièges et embuscades… puis le Roi-Liche'],
    badges: [['golden_sword', '4 classes'], ['amethyst_shard', 'Âmes et Forge'], ['totem_of_undying', 'Le Roi-Liche']],
    fonctions: [
      ['shield', 'Quatre classes', 'Chevalier au bouclier, Archère rapide, Mage et ses éclairs, Gladiateur au trident.'],
      ['compass', 'Douze niveaux', 'Générés à chaque partie, du 1.1 au 4.3, avec un bestiaire qui change à chaque palier.'],
      ['amethyst_shard', 'Les Âmes', 'Chaque monstre en donne à toute l’escouade. Elles se gardent d’une expédition à l’autre.'],
      ['golden_apple', 'La Forge', 'Armes, enchantements, armure et consommables propres à ta classe.'],
      ['tnt', 'Pièges et embuscades', 'Dalles piégées, coffres qui réveillent une vague, champions brillants.'],
      ['totem_of_undying', 'Le Roi-Liche', 'Au niveau 3.3, avec sa barre de vie et sa furie à mi-vie.'],
    ],
    classements: [['donjon_victoires', 'Rois-Liches vaincus', (v) => nombre(v)], ['donjon_etage', 'Niveau atteint', (v) => nombre(v)], ['donjon_monstres', 'Monstres vaincus', (v) => nombre(v)]],
  },
  duel: {
    num: '04', nom: '1 vs 1', court: 'Le premier qui… gagne.', accroche: 'Le premier qui… gagne.',
    texte: "Un vrai monde, un adversaire, dix minutes et un défi tiré au sort : le premier qui trouve un diamant, qui mange un steak, qui dort dans un lit, qui grille cinq totems… Chaque duel part d'un coin du monde jamais visité.",
    points: ['Une trentaine de défis, du plus bête au plus tendu', 'Un classement ELO propre au 1 vs 1', 'Défie directement un ami, ou passe par la file', 'Mourir (sauf si c’est le défi) renvoie au départ, sans inventaire'],
    badges: [['clock', '10 minutes'], ['diamond', '30 défis'], ['name_tag', 'Classé ELO']],
    fonctions: [
      ['book', 'Trente défis', 'Trouver un diamant, pêcher, dormir, mourir d’une chute, toucher la bedrock…'],
      ['compass', 'Un monde neuf', 'Départ côte à côte, à des milliers de blocs des autres duels.'],
      ['clock', 'Dix minutes', 'Une course, pas un combat : pas de PvP, le premier qui réussit gagne.'],
      ['name_tag', 'Classement ELO', 'Grimpe au classement du 1 vs 1 duel après duel.'],
      ['firework_rocket', 'Défie tes amis', '/duel defier, il accepte, c’est parti. Sans attendre la file.'],
      ['diamond', 'Des gemmes', 'Chaque duel gagné rapporte des gemmes.'],
    ],
    classements: [['duel_elo', 'ELO du 1 vs 1', (v) => `${nombre(v)} ELO`], ['duel_victoires', 'Duels gagnés', (v) => nombre(v)]],
  },
};

const GRADES = [
  { id: 'habitue', nom: 'Habitué', prix: 500, resume: 'Le premier palier, à gagner en jouant.', avantages: ['100% accessible en jouant et en votant', 'Préfixe [Habitué] et titre « ✧ Habitué »', '+2 gemmes par jour (/quotidien)', 'Une clé du Coffre Habitué chaque jour', 'Rôle Discord'] },
  { id: 'vip', nom: 'VIP', prix: 7500, tag: 'Populaire', resume: 'Priorité, vol et cosmétiques exclusifs.', avantages: ['Tout le Habitué inclus', 'Préfixe [VIP] vert', '+8 gemmes par jour (/quotidien)', 'Une clé du Coffre VIP chaque jour', 'Titre « ✔ VIP » et couronne en or exclusifs', 'Vol au lobby et mise à jour de skin', 'Accès prioritaire si le serveur est plein', 'Rôle Discord VIP'] },
  { id: 'elite', nom: 'Élite', prix: 18000, resume: 'Dégradé, cosmétiques débloqués et commandes lobby.', avantages: ['Tout le VIP inclus', 'Préfixe [Élite] bleu ciel', '+20 gemmes par jour (/quotidien)', 'Une clé du Coffre Élite chaque jour', 'Titre « ◆ Élite », dégradé de pseudo, familier Panda et particule Enchanté exclusifs', 'Ailes arc-en-ciel, Ailes d’Ange, Super Héros, Infernal et Hélix de sang débloqués', 'Commandes lobby /glow, /hat, /sit', 'Accès prioritaire aux salons d’escouade et groupes étendus'] },
  { id: 'legende', nom: 'Légende', prix: 38000, tag: 'Prestige', resume: 'Le grade ultime : doré, animé, sonore et permanent.', avantages: ['Tout l’Élite inclus', 'Préfixe [Légende] doré suprême', '+50 gemmes par jour (/quotidien)', 'Une clé du Coffre Légende chaque jour', 'Titre doré, dégradé animé, Halo divin, chapeau Ange et familier Renifleur exclusifs', 'Annonce sonore et feux d’artifice à l’arrivée', 'Vol rapide réglable /flyspeed et aura divine au lobby', 'Place réservée garantie même si le serveur est complet (100%)'] },
];

// ------------------------------------------------------------------ gabarit

const LOGO = () => image('marque/logo-perso', `/img/marque/logo.svg?v=${version('img/marque/logo.svg')}`);

function page({ titre: titrePage, actif = '', corps, description = '', indexer = true, jsonld = [], image: imagePartage = '/img/og.png' }, res) {
  const req = res.req;
  // Pages personnelles jamais en cache partagé ; les autres toujours revalidées (elles portent le jeton CSRF du visiteur).
  res.set('Cache-Control', !indexer || res.locals.session ? 'private, no-store' : 'private, no-cache');
  if (!indexer) res.set('X-Robots-Tag', 'noindex, nofollow');
  const titreComplet = titrePage ? `${titrePage} · ${NOM}` : `${NOM} · Serveur Minecraft Java ${config.versionJeu}`;
  const descriptionFinale = description || `${NOM} : serveur Minecraft Java ${config.versionJeu} gratuit. Tower Defense, Extraction, Donjon et 1 vs 1 : quatre jeux originaux, sans mod à installer et sans pay-to-win.`;
  const cat = req && typeof req.query.cat === 'string' && Object.hasOwn(CATS, req.query.cat) ? `?cat=${req.query.cat}` : '';
  const canonique = seo.url(`${req ? req.path : '/'}${cat}`);
  const avecApercus = corps.includes('apercu-perso') || corps.includes('apercu-trainee');
  const s = res.locals.session;
  const lien = (href, texte, cle) => `<a href="${href}" class="${actif === cle ? 'actif' : ''}">${texte}</a>`;
  const jeux = Object.entries(JEUX).map(([id, j]) => `<a href="/jeux/${id}"><img src="${image(`site/jeu-${id}`, `/img/jeu/mode-${id}.png`)}" alt="" width="48" height="48"><span><b>${esc(j.nom)}</b><small>${esc(j.court)}</small></span></a>`).join('');
  const compte = s ? `<a class="btn btn-contour btn-petit" href="/compte">${esc(s.pseudo)}</a>` : '<a class="btn btn-contour btn-petit" href="/connexion">Connexion</a>';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreComplet)}</title>
<meta name="description" content="${esc(descriptionFinale.slice(0, 300))}">
<meta name="keywords" content="serveur minecraft, serveur minecraft francais, serveur minecraft java, serveur minecraft 1.21, tower defense minecraft, donjon mmorpg minecraft, lethal extraction minecraft, serveur crack accepte, pvp 1v1 minecraft, orbismc, mcorbis">
<meta name="author" content="${esc(NOM)}">
<meta name="robots" content="${indexer ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow'}">
${indexer ? `<link rel="canonical" href="${esc(canonique)}">` : ''}
<meta name="theme-color" content="#5b2fd1">
<meta name="google-site-verification" content="google3ebe9a7838b68fc4">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(NOM)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(titreComplet)}">
<meta property="og:description" content="${esc(descriptionFinale.slice(0, 300))}">
<meta property="og:url" content="${esc(canonique)}">
<meta property="og:image" content="${esc(seo.url(imagePartage))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(NOM)}, serveur Minecraft">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titreComplet)}">
<meta name="twitter:description" content="${esc(descriptionFinale.slice(0, 200))}">
<meta name="twitter:image" content="${esc(seo.url(imagePartage))}">
<link rel="apple-touch-icon" href="/img/marque/embleme-180.png">
<link rel="manifest" href="/site.webmanifest">
${jsonld.map((o) => seo.jsonLd(o)).join('\n')}
<link rel="preload" href="/fonts/lilita-one-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=${V_CSS}">
<link rel="stylesheet" href="/css/cosmetiques.css">
${avecApercus ? `<link rel="stylesheet" href="/css/apercus.css?v=${V_APERCUS}">` : ''}
<link rel="icon" href="/img/favicon.svg?v=${version('img/favicon.svg')}" type="image/svg+xml">
<script src="/js/site.js?v=${V_JS}" defer></script>
</head>
<body>
<a class="visuellement-cache" href="#contenu">Aller au contenu</a>
<header class="entete"><div class="barre">
  <a class="marque" href="/" aria-label="${esc(NOM)}, accueil"><img src="${LOGO()}" alt="${esc(NOM)}" width="101" height="46"></a>
  <nav class="nav" aria-label="Navigation principale">
    ${lien('/votes', 'Voter', 'votes')}
    ${lien('/boutique', 'Boutique', 'boutique')}
    <details class="menu-jeux"><summary class="${actif === 'jeux' ? 'actif' : ''}">Jeux</summary><div class="deroulant">${jeux}</div></details>
    ${lien('/classements', 'Classements', 'classements')}
    ${lien('/wiki', 'Wiki & Commandes', 'wiki')}
    ${lien('/contact', 'Contact', 'contact')}
    ${DISCORD ? `<a href="${esc(DISCORD)}" rel="noopener">Discord</a>` : ''}
  </nav>
  <div class="entete-droite">
    ${compte}
    <a class="btn btn-petit" href="/#rejoindre">Jouer</a>
    <details class="burger"><summary aria-label="Menu"><span></span></summary><div class="burger-panneau">
      <a href="/">Accueil</a>${Object.entries(JEUX).map(([id, j]) => `<a href="/jeux/${id}">${esc(j.nom)}</a>`).join('')}
      <a href="/classements">Classements</a><a href="/votes">Voter</a><a href="/boutique">Boutique</a><a href="/wiki">Wiki & Commandes</a><a href="/contact">Contact</a>
      <a class="btn btn-contour btn-plein" href="${s ? '/compte' : '/connexion'}">${s ? esc(s.pseudo) : 'Connexion'}</a>
    </div></details>
  </div>
</div></header>
<main id="contenu">${corps}</main>
<footer class="pied"><div class="enveloppe">
  <div class="pied-grille">
    <div>
      <a class="marque" href="/"><img src="${LOGO()}" alt="${esc(NOM)}" width="167" height="76"></a>
      <p>Serveur Minecraft Java ${esc(config.versionJeu)}. Quatre jeux originaux, gratuits, sans mod à installer et sans pay-to-win.</p>
      <div class="actions">${DISCORD ? `<a class="btn btn-discord btn-petit" href="${esc(DISCORD)}" rel="noopener">Discord</a>` : ''}<a class="btn btn-petit" href="/#rejoindre">Jouer</a></div>
    </div>
    <div><h4>Jeux</h4>${Object.entries(JEUX).map(([id, j]) => `<a href="/jeux/${id}">${esc(j.nom)}</a>`).join('')}</div>
    <div><h4>Communauté</h4><a href="/wiki">Wiki & Commandes</a><a href="/classements">Classements</a><a href="/votes">Voter</a><a href="/contact">Contact & Support</a>${DISCORD ? `<a href="${esc(DISCORD)}" rel="noopener">Discord</a>` : ''}</div>
    <div><h4>Compte & Légal</h4><a href="/boutique">Boutique</a><a href="/compte">Mon compte</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité (RGPD)</a><a href="/cgv">Conditions de vente</a></div>
  </div>
  <div class="mentions"><span>© ${new Date().getFullYear()} ${esc(NOM)}</span><span>${esc(NOM)} n'est pas un produit officiel de Minecraft. Ni approuvé par Mojang ou Microsoft, ni associé à eux.</span></div>
</div></footer>
</body>
</html>`;
}

function avis(texte, type = '') {
  return texte ? `<div class="avis ${type}" role="${type === 'erreur' ? 'alert' : 'status'}">${esc(texte)}</div>` : '';
}

function tableau(lignes, formater = (v) => nombre(v), depart = 0) {
  if (!lignes.length) return '<div class="vide">Personne encore. La première place est libre.</div>';
  return `<table class="classement"><tbody>${lignes.map((l, k) => `<tr><td class="rang">#${depart + k + 1}</td>`
    + `<td>${lienJoueur(l)}${titre(l.titre)}</td><td class="valeur">${formater(l.valeur)}</td></tr>`).join('')}</tbody></table>`;
}

function ip() {
  const discordUrl = DISCORD || 'https://discord.gg/Xeg7AH3X9B';
  if (!config.ouvert) {
    return `<div class="ip ip-bientot"><span class="badge-bientot"><i class="point-pulse"></i>Bientôt disponible</span><a class="btn-ip-discord" href="${esc(discordUrl)}" target="_blank" rel="noopener"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028z"/></svg>Rejoindre le Discord</a></div>`;
  }
  return `<div class="ip"><code>${esc(config.adresseJeu)}</code><button type="button" data-copier>Copier l'IP</button></div>`;
}

function enLigne(statut) {
  if (statut && statut.enLigne) {
    return `<i class="point vivant"></i><b class="nb">${nombre(statut.joueurs)}</b> joueur${statut.joueurs > 1 ? 's' : ''} en ligne`;
  }
  return config.ouvert ? '<i class="point"></i>Serveur en maintenance' : '<i class="point en-attente"></i>Ouverture imminente';
}

function tetePage(etiquette, titreP, texte, classe = '', extra = '') {
  return `<section class="bandeau-page ${classe}"><div class="enveloppe"><span class="etiquette-section">${esc(etiquette)}</span><h1>${esc(titreP)}</h1>${texte ? `<p>${esc(texte)}</p>` : ''}${extra}</div></section>`;
}

// ------------------------------------------------------------------ accueil

function accueil(res, { statut, chiffres, topElo, topVague, topQuotas, equipe, records }) {
  const defile = ['Gratuit', `Java ${config.versionJeu}`, 'Sans pay-to-win', '4 jeux originaux', 'Aucun mod', config.ouvert ? config.adresseJeu : 'Ouverture prochaine sur Discord'];
  const corps = `
<section class="heros"><div class="enveloppe bento">
  <a class="tuile tuile-boutique" href="/boutique">
    <span class="grand-mot">Boutique</span>
    <span class="sous">Grades et cosmétiques</span>
    <img src="${image('site/tuile-boutique', '/img/jeu/icone-coffre.png')}" alt="" width="300" height="300">
  </a>
  <div class="tuile tuile-banniere">
    <img class="fond" src="${image('scene', `/img/scene.svg?v=${V_SCENE}`)}" alt="" width="1920" height="1080">
    <img class="logo" src="${LOGO()}" alt="${esc(NOM)}" width="320" height="145">
    <h1>Quatre jeux originaux, un seul serveur.</h1>
    <a class="btn btn-blanc" href="#jeux">Découvrir les jeux</a>
  </div>
  <div class="tuile tuile-jouer" id="rejoindre">
    <span class="grand-mot">${config.ouvert ? 'Jouer maintenant' : 'Rejoindre'}</span>
    <span class="sous">${enLigne(statut)} · Java ${esc(config.versionJeu)}</span>
    ${ip()}
  </div>
  <a class="tuile tuile-voter" href="/votes">
    <div><span class="grand-mot">Voter</span><div class="sous">Une clé de coffre par vote</div></div>
    <img src="${image('site/tuile-voter', '/img/jeu/cle-vote.png')}" alt="" width="80" height="80">
  </a>
  <a class="tuile tuile-discord" href="${esc(DISCORD || '/#faq')}"${DISCORD ? ' rel="noopener"' : ''}>
    <img src="${image('site/tuile-discord', `/img/marque/discord.svg?v=${version('img/marque/discord.svg')}`)}" alt="Discord" width="92" height="70">
    <div><span class="grand-mot">Discord</span><div class="sous">${DISCORD ? 'Rejoins la communauté' : 'Bientôt disponible'}</div></div>
  </a>
</div></section>
<div class="defile-cadre" aria-hidden="true"><div class="defile"><div class="defile-piste">${Array(8).fill(defile).flat().map((t) => `<span>${esc(t)}</span>`).join('')}</div></div></div>

<section class="section" id="jeux"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Jeux</span><h2>Un serveur, quatre aventures</h2>
  <p>Ton grade, tes gemmes et tes cosmétiques te suivent partout. Change de jeu depuis le lobby, sans te reconnecter.</p></div>
  <div class="grille-jeux">${Object.entries(JEUX).map(([id, j]) => {
    const capture = captures(id)[0];
    return `<article class="carte-jeu ${id}">
    <div class="visuel">${capture ? `<img class="capture" src="${capture}" alt="" loading="lazy">` : `<img src="${image(`site/jeu-${id}`, `/img/jeu/mode-${id}.png`)}" alt="" width="200" height="200" loading="lazy">`}
      <div class="badges"><span class="badge">Java ${esc(config.versionJeu)}</span><span class="badge accent">Jeu ${j.num}</span></div></div>
    <div class="corps"><h3>${esc(j.nom)}</h3><div class="accroche">${esc(j.accroche)}</div><p>${esc(j.texte)}</p>
      <div class="actions"><a class="btn btn-petit" href="#rejoindre">Jouer</a><a class="btn btn-contour btn-petit" href="/jeux/${id}">En savoir plus</a></div></div>
  </article>`;
  }).join('')}</div>
</div></section>

<section class="section section-blanche"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">${esc(NOM)} en chiffres</span><h2>Une communauté qui grandit</h2><p>Mis à jour en direct depuis le serveur.</p></div>
  <div class="boite-chiffres">
    <div class="chiffre fort"><b class="nb">${statut.enLigne ? nombre(statut.joueurs) : '0'}</b><span>joueurs en ligne</span><a class="btn btn-blanc btn-petit" href="#rejoindre">Rejoindre</a></div>
    <div class="chiffre"><b class="nb">${nombre(chiffres.joueurs)}</b><span>joueurs inscrits</span></div>
    <div class="chiffre"><b class="nb">${nombre(chiffres.heures)}</b><span>heures de jeu</span></div>
    <div class="chiffre"><b class="nb">${nombre(chiffres.monstresDonjon)}</b><span>monstres tués dans le Donjon</span></div>
  </div>
</div></section>

<section class="section" id="grades"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Grades</span><h2>Privilèges et prestige</h2>
  <p>Accès prioritaire en cas de file d'attente, vol au lobby, gemmes quotidiennes et cosmétiques exclusifs. Équité totale garantie : aucun avantage pay-to-win dans les jeux.</p></div>
  <div class="grille-grades">${GRADES.map((g) => `<a class="grade-carte g-${g.id}" href="/boutique"><img src="${image(`site/grade-${g.id}`, `/img/jeu/grade-${g.id}.png`)}" alt="" width="88" height="104" loading="lazy"><b>${esc(g.nom)}</b><span>${esc(g.resume)}</span><span class="prix-mini">${nombre(g.prix)} gemmes</span></a>`).join('')}</div>
  <div class="actions actions-centre"><a class="btn btn-grand" href="/boutique">Voir la boutique</a></div>
</div></section>

<section class="section section-blanche"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Classements</span><h2>Les meilleurs du moment</h2></div>
  <div class="grille-3">
    <div class="panneau"><div class="panneau-tete"><h3>Arène ELO</h3><span class="pastille">Tower Defense</span></div>${tableau(topElo)}</div>
    <div class="panneau"><div class="panneau-tete"><h3>Record de vague</h3><span class="pastille">Tower Defense</span></div>${tableau(topVague, (v) => `vague ${nombre(v)}`)}</div>
    <div class="panneau"><div class="panneau-tete"><h3>Quotas tenus</h3><span class="pastille">Extraction</span></div>${tableau(topQuotas)}</div>
  </div>
  <div class="actions actions-centre"><a class="btn btn-contour" href="/classements">Tous les classements</a></div>
</div></section>

<section class="section"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Rejoindre</span><h2>${config.ouvert ? 'Trente secondes, top chrono' : 'Prépare ton arrivée'}</h2></div>
  <div class="etapes">
    <div class="panneau etape"><span class="num">1</span><h3>${config.ouvert ? `Lance la ${esc(config.versionJeu)}` : 'Prépare Minecraft'}</h3><p>Dans ton launcher, prépare Minecraft Java <b>${esc(config.versionJeu)}</b>. Comptes officiels et alternatifs acceptés.</p></div>
    <div class="panneau etape"><span class="num">2</span><h3>${config.ouvert ? 'Ajoute le serveur' : 'Rejoins le Discord'}</h3><p>${config.ouvert ? `Multijoueur, Ajouter un serveur, adresse <b>${esc(config.adresseJeu)}</b>. Accepte le pack du serveur.` : `L'adresse IP officielle sera dévoilée sur notre Discord avant le grand lancement : <a href="${esc(DISCORD || 'https://discord.gg/Xeg7AH3X9B')}" target="_blank" rel="noopener" class="lien"><b>Rejoindre la communauté</b></a>.`}</p></div>
    <div class="panneau etape"><span class="num">3</span><h3>${config.ouvert ? 'Choisis ton jeu' : 'Sois prêt pour le jour J'}</h3><p>${config.ouvert ? 'Compte officiel : tu entres directement. Sinon, choisis un mot de passe à ta première connexion.' : 'Participe aux concours de lancement, découvre les 4 jeux en avant-première et réserve ton pseudo !'}</p></div>
  </div>
</div></section>

<section class="section section-blanche" id="faq"><div class="enveloppe grille-2">
  <div>
    <span class="etiquette-section">Questions</span><h2>Questions fréquentes</h2>
    <p>Une autre question ? L'équipe répond en jeu${DISCORD ? ' et sur le Discord' : ''}.</p>
    ${equipe.length ? `<div class="equipe">${equipe.map((m) => `<a class="membre" href="/joueur/${encodeURIComponent(m.pseudo)}">${tete(m.pseudo)}<span><b>${esc(m.pseudo)}</b><span class="pastille ${esc(m.grade)}">${esc(NOMS_GRADES[m.grade])}</span></span></a>`).join('')}</div>` : ''}
  </div>
  <div class="faq">
    <details><summary>Faut-il un compte Minecraft acheté ?</summary><p>Non. Avec un compte officiel, tu entres directement avec ton skin. Sans, tu choisis un mot de passe à ta première visite : il protège ton pseudo, tes gemmes et ton grade. Change de skin en jeu avec /skin.</p></details>
    <details><summary>Faut-il installer des mods ?</summary><p>Aucun. Le serveur envoie un pack de ressources (menus et icônes) que le jeu télécharge une seule fois.</p></details>
    <details><summary>Les achats donnent-ils un avantage ?</summary><p>Les grades offrent de précieux privilèges de confort (accès prioritaire si le serveur est complet, vol au lobby, gemmes et clés quotidiennes), tout en garantissant une équité totale en jeu : aucune arme, amélioration de combat ou ressource de partie ne s'achète avec de l'argent réel.</p></details>
    <details><summary>Comment me connecter au site ?</summary><p>Avec ton pseudo et ton mot de passe du serveur. Compte officiel : tape /site en jeu pour recevoir un lien de connexion valable dix minutes.</p></details>
    <details><summary>Le serveur est-il gratuit ?</summary><p>Oui, entièrement. La boutique sert seulement à soutenir le serveur et à personnaliser ton apparence.</p></details>
  </div>
</div></section>

<section class="section"><div class="enveloppe"><div class="appel">
  <img class="logo" src="${LOGO()}" alt="" width="320" height="145">
  <h2>${config.ouvert ? 'Prêt pour l\'aventure ?' : 'Ouverture très prochaine'}</h2>
  <p>${config.ouvert ? `Copie l'adresse, lance Minecraft ${esc(config.versionJeu)} et rejoins-nous au lobby.` : 'Rejoins notre Discord officiel pour être averti dès l\'ouverture des portes et obtenir l\'adresse IP !'}</p>
  ${ip()}
</div></div></section>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: NOM, url: seo.url('/'), logo: seo.url('/img/marque/logo.png'), ...(DISCORD ? { sameAs: [DISCORD] } : {}) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: NOM, url: seo.url('/'), inLanguage: 'fr-FR' },
    {
      '@context': 'https://schema.org', '@type': 'VideoGame', name: NOM, url: seo.url('/'), inLanguage: 'fr',
      description: `Serveur Minecraft Java ${config.versionJeu} avec quatre jeux originaux : ${Object.values(JEUX).map((j) => j.nom).join(', ')}.`,
      gamePlatform: 'Minecraft Java Edition', genre: ['Tower Defense', 'Survie', 'Donjon', 'Multijoueur'], playMode: 'MultiPlayer',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
    },
  ];
  return page({ corps, actif: 'accueil', jsonld }, res);
}

// ------------------------------------------------------------------ page d'un jeu

function jeu(res, id, { tops, statut }) {
  const j = JEUX[id];
  const liste = captures(id);
  const corps = `
<section class="bandeau-page ${id}"><div class="enveloppe bandeau-jeu">
  <div><span class="etiquette-section">Jeu ${j.num} · ${esc(j.accroche)}</span><h1>${esc(j.nom)}</h1><p>${esc(j.texte)}</p>
    <div class="actions"><a class="btn" href="/#rejoindre">Jouer maintenant</a><a class="btn btn-blanc" href="/classements/${id}">Classement</a></div></div>
  <img src="${image(`site/jeu-${id}`, `/img/jeu/mode-${id}.png`)}" alt="" width="340" height="340">
</div></section>

<section class="section ${id}"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Au programme</span><h2>Ce qui t'attend</h2></div>
  <div class="grille-3">${j.fonctions.map(([ic, t, d]) => `<div class="panneau fonction"><img src="${i(ic)}" alt="" width="52" height="52"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>

${liste.length ? `<section class="section section-blanche"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">En images</span><h2>Captures</h2></div>
  <div class="galerie">${liste.map((c) => `<a href="${c}"><img src="${c}" alt="Capture du mode ${esc(j.nom)}" loading="lazy"></a>`).join('')}</div>
</div></section>` : ''}

<section class="section section-blanche"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Classements</span><h2>Les meilleurs en ${esc(j.nom)}</h2></div>
  <div class="grille-${Math.min(3, j.classements.length)}">${j.classements.map(([, nomC, f], k) => `<div class="panneau"><div class="panneau-tete"><h3>${esc(nomC)}</h3></div>${tableau(tops[k], f)}</div>`).join('')}</div>
</div></section>

<section class="section"><div class="enveloppe"><div class="appel">
  <h2>Envie d'essayer ?</h2><p>${config.ouvert ? `${enLigne(statut)}. Rejoins le serveur et choisis ${esc(j.nom)} au lobby.` : `Rejoins le Discord officiel pour être parmi les premiers testeurs lors de l'ouverture de ${esc(j.nom)} !`}</p>${ip()}
</div></div></section>`;
  return page({ titre: `${j.nom} : mode de jeu Minecraft`, actif: 'jeux', corps, description: `${j.nom} sur ${NOM} : ${j.texte}`, jsonld: [seo.fil([['Jeux', '/#jeux'], [j.nom, `/jeux/${id}`]])] }, res);
}

// ------------------------------------------------------------------ classements

const ONGLETS = {
  td: { nom: 'Tower Defense', cle: 'td_elo', sous: 'Arène ELO', format: (v) => `${nombre(v)} ELO` },
  vague: { nom: 'Record de vague', cle: 'td_record', sous: 'Tower Defense', format: (v) => `vague ${nombre(v)}` },
  raids: { nom: 'Raids gagnés', cle: 'td_raids_gagnes', sous: 'Tower Defense', format: (v) => nombre(v) },
  lethal: { nom: 'Extraction', cle: 'lethal_quotas', sous: 'Quotas tenus', format: (v) => `${nombre(v)} quotas` },
  ferraille: { nom: 'Ferraille', cle: 'lethal_ferraille', sous: 'Extraction', format: (v) => `${nombre(v)} ₵` },
  donjon: { nom: 'Donjon', cle: 'donjon_victoires', sous: 'Rois-Liches vaincus', format: (v) => `${nombre(v)} victoire${v > 1 ? 's' : ''}` },
  duel: { nom: '1 vs 1', cle: 'duel_elo', sous: 'ELO du duel', format: (v) => `${nombre(v)} ELO` },
  temps: { nom: 'Temps de jeu', cle: null, sous: 'Tous les jeux', format: (v) => duree(v) },
};
// Anciennes adresses.
ONGLETS.elo = ONGLETS.td;
ONGLETS.quotas = ONGLETS.lethal;

function classements(res, onglet, lignes) {
  const o = ONGLETS[onglet];
  const podium = lignes.slice(0, 3);
  const ordre = [1, 0, 2].filter((k) => podium[k]);
  const corps = `
${tetePage(`Classements · ${o.sous}`, o.nom, 'Les meilleurs joueurs du serveur, mis à jour en direct.')}
<section class="page"><div class="enveloppe">
  <div class="onglets">${Object.entries(ONGLETS).filter(([k]) => k !== 'elo' && k !== 'quotas').map(([k, v]) => `<a href="/classements/${k}" class="${v === o ? 'actif' : ''}">${esc(v.nom)}</a>`).join('')}</div>
  ${podium.length ? `<div class="podium">${ordre.map((k) => `<a class="marche p${k + 1}" href="/joueur/${encodeURIComponent(podium[k].pseudo)}"><div class="place">#${k + 1}</div>${tete(podium[k].pseudo)}<b>${nomColore(podium[k])}</b><span class="valeur">${o.format(podium[k].valeur)}</span></a>`).join('')}</div>` : ''}
  <div class="panneau table-defile">${lignes.length > 3 ? tableau(lignes.slice(3), o.format, 3) : lignes.length ? '<div class="vide">La suite du classement se remplira avec les prochaines parties.</div>' : tableau([])}</div>
</div></section>`;
  return page({ titre: `Classement ${o.nom}`, actif: 'classements', corps, description: `Classement ${o.nom} (${o.sous}) des joueurs de ${NOM} : les meilleurs du serveur Minecraft, mis à jour en direct.`, jsonld: [seo.fil([['Classements', '/classements'], [o.nom, `/classements/${onglet}`]])] }, res);
}

// ------------------------------------------------------------------ profils

function blocStats(st) {
  const v = (k, f = nombre) => (st[k] === undefined ? '—' : f(st[k]));
  const groupe = (id, nomG, lignes) => `<div class="groupe-stats ${id}"><h3>${esc(nomG)}</h3><div class="stats">${lignes.map(([k, l, f]) => `<div class="stat"><b>${v(k, f)}</b><span>${esc(l)}</span></div>`).join('')}</div></div>`;
  return groupe('td', 'Tower Defense', [['td_record', 'Record de vague'], ['td_elo', "ELO d'arène"], ['td_raids_gagnes', 'Raids gagnés']])
    + groupe('lethal', 'Extraction', [['lethal_quotas', 'Meilleure série de quotas'], ['lethal_ferraille', 'Ferraille rapportée'], ['lethal_jours', 'Journées survécues']])
    + groupe('donjon', 'Donjon', [['donjon_etage', 'Niveau atteint'], ['donjon_victoires', 'Rois-Liches vaincus'], ['donjon_monstres', 'Monstres vaincus'], ['donjon_ames', 'Âmes en réserve']])
    + groupe('duel', '1 vs 1', [['duel_victoires', 'Duels gagnés'], ['duel_elo', 'ELO du 1 vs 1']]);
}

function enTeteProfil(p) {
  return `<section class="bandeau-page"><div class="enveloppe"><div class="profil-tete">${tete(p.pseudo)}
    <div><span class="etiquette-section">Profil joueur</span><h1>${nomColore(p)}</h1>
    <div class="meta"><span class="pastille ${esc(p.grade)}">${esc(NOMS_GRADES[p.grade] || 'Joueur')}</span>${titre(p.titre)}</div></div></div></div></section>`;
}

function joueur(res, p) {
  const corps = `${enTeteProfil(p)}
<section class="page"><div class="enveloppe">
  <p class="discret">Arrivé le ${esc(date(p.premiere))} · ${esc(duree(p.temps_jeu))} de jeu · vu le ${esc(date(p.derniere))}</p>
  <div class="panneau panneau-corps">${blocStats(p.stats)}</div>
</div></section>`;
  return page({ titre: `${p.pseudo} : profil joueur`, corps, description: `Profil de ${p.pseudo} sur ${NOM} : statistiques Tower Defense, Extraction, Donjon et 1 vs 1.`, jsonld: [{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: p.pseudo, url: seo.url(`/joueur/${p.pseudo}`) } }] }, res);
}

function introuvable(res, message = "Cette page n'existe pas.") {
  const corps = tetePage('Erreur', 'Perdu dans le vide', message, '', '<div class="actions"><a class="btn" href="/">Retour à l\'accueil</a></div>') + '<section class="page"></section>';
  return page({ titre: 'Introuvable', corps, indexer: false }, res);
}

// ------------------------------------------------------------------ connexion et compte

function connexion(res, { erreur = '', code = '', pseudo = '' } = {}) {
  const csrf = esc(res.locals.csrf);
  const corps = `
${tetePage('Mon compte', 'Connexion', 'Retrouve tes gemmes, tes cosmétiques et tes statistiques.')}
<section class="page"><div class="enveloppe">
  ${avis(erreur, 'erreur')}
  <div class="connexion">
    <div class="panneau panneau-corps">
      <span class="etiquette-section">Avec un mot de passe</span><h2>Pseudo et mot de passe</h2>
      <p>Connecte-toi directement avec ton pseudo et le mot de passe de ton compte.</p>
      <form class="formulaire" method="post" action="/connexion" autocomplete="on">
        <input type="hidden" name="_csrf" value="${csrf}">
        <label>Pseudo<input name="pseudo" required maxlength="16" pattern="[A-Za-z0-9_]{3,16}" value="${esc(pseudo)}" autocomplete="username"></label>
        <label>Mot de passe<input name="mdp" type="password" required maxlength="64" autocomplete="current-password"></label>
        <button class="btn btn-plein" type="submit">Se connecter</button>
      </form>
    </div>
    <div class="panneau panneau-corps">
      <span class="etiquette-section">Avec un code</span><h2>Code de connexion</h2>
      <p>Pas envie de taper ton mot de passe ? Tape <code>/site</code> en jeu pour te connecter instantanément avec un code temporaire.</p>
      <form class="formulaire" method="post" action="/connexion/code">
        <input type="hidden" name="_csrf" value="${csrf}">
        <label>Code<input name="code" required maxlength="8" value="${esc(code)}" autocomplete="one-time-code" spellcheck="false"></label>
        <button class="btn btn-violet btn-plein" type="submit">Valider le code</button>
      </form>
    </div>
  </div>
</div></section>`;
  return page({ titre: 'Connexion', actif: 'compte', corps, indexer: false }, res);
}

function compte(res, { p, catalogue, message: codeOk, erreur: codeErreur, cat: catDemandee }) {
  const message = messageOk(codeOk), erreur = messageErreur(codeErreur);
  const csrf = esc(res.locals.csrf);
  const journal = p.journal.length
    ? `<ul class="journal">${p.journal.map((j) => `<li><span>${esc(j.raison)} <span class="discret">· ${esc(j.serveur || '')}, ${esc(date(j.date))}</span></span><span class="${j.delta >= 0 ? 'plus' : 'moins'}">${j.delta >= 0 ? '+' : ''}${nombre(j.delta)}</span></li>`).join('')}</ul>`
    : '<div class="vide">Aucun mouvement pour l\'instant.</div>';
  const possedes = catalogue.filter((c) => p.possedes.has(c.id));
  const equipes = new Set([p.titre, p.couleur, p.trainee, p.chapeau, p.compagnon]);
  const cat = categorieValide(catDemandee);
  const dansCat = possedes.filter((c) => c.categorie === CATS[cat].cle).sort((a, b) => Number(equipes.has(b.id)) - Number(equipes.has(a.id)));
  const mesCosmetiques = `<div class="panneau" id="cosmetiques"><div class="panneau-tete"><h3>Mes cosmétiques</h3><span class="pastille">${possedes.length} / ${catalogue.length}</span></div>
    ${ongletsCosmetiques('/compte?', cat, (cle) => possedes.filter((c) => c.categorie === cle).length, '#cosmetiques')}
    <div class="panneau-corps">
      <p class="petit discret aide-cat">${esc(CATS[cat].aide)}</p>
      ${dansCat.length ? `<div class="minis">${dansCat.map((c) => `<div class="mini ${equipes.has(c.id) ? 'equipe' : ''}"><div class="mini-apercu r-${rarete(c).cls}">${visuelCosmetique(c, p.pseudo)}</div><div class="mini-infos"><b>${esc(c.nom)}</b>${String(c.categorie).startsWith('UC_') ? '<span class="actuel">Menu ✨ en jeu</span>' : equipes.has(c.id) ? '<span class="actuel">Équipé</span>' : `<form method="post" action="/compte/equiper"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="id" value="${esc(c.id)}"><input type="hidden" name="cat" value="${cat}"><button class="lien-bouton" type="submit">Équiper</button></form>`}</div></div>`).join('')}</div>`
        : `<div class="vide">Aucun ${esc(CATS[cat].nom.toLowerCase())} pour l'instant. <a class="lien" href="/boutique/cosmetiques?cat=${cat}">Voir la boutique</a></div>`}
    </div></div>`;
  const corps = `${enTeteProfil(p)}
<section class="page"><div class="enveloppe">
  ${avis(message, 'succes')}${avis(erreur, 'erreur')}
  <div class="grille-3">
    <div class="panneau panneau-corps"><span class="etiquette-section">Gemmes</span><div class="grand-chiffre nb">${nombre(p.gemmes)}</div></div>
    <div class="panneau panneau-corps"><span class="etiquette-section">Temps de jeu</span><div class="grand-chiffre">${esc(duree(p.temps_jeu))}</div></div>
    <div class="panneau panneau-corps"><span class="etiquette-section">Actions</span><div class="actions"><a class="btn btn-petit" href="/boutique">Boutique</a>
      <form method="post" action="/deconnexion"><input type="hidden" name="_csrf" value="${csrf}"><button class="btn btn-contour btn-petit" type="submit">Déconnexion</button></form></div></div>
  </div>
  <div class="panneau panneau-corps marge-haut">${blocStats(p.stats)}</div>
  <div class="compte-bas marge-haut">
    ${mesCosmetiques}
    <div class="panneau journal-panneau"><div class="panneau-tete"><h3>Mouvements de gemmes</h3><span class="pastille">15 derniers</span></div>${journal}</div>
  </div>
</div></section>`;
  return page({ titre: 'Mon compte', actif: 'compte', corps, indexer: false }, res);
}

// ------------------------------------------------------------------ boutique

// Catégories de cosmétiques : adresse (?cat=), clé du catalogue, libellé, icône.
const CATS = {
  titres: { cle: 'TITRE', nom: 'Titres', icone: 'cat-titres', aide: 'Affiché devant ton pseudo dans le chat.' },
  couleurs: { cle: 'COULEUR', nom: 'Couleurs', icone: 'cat-couleurs', aide: 'La couleur de ton pseudo, au-dessus de ta tête et dans le chat.' },
  chapeaux: { cle: 'UC_CHAPEAU', nom: 'Chapeaux', icone: 'cat-chapeaux', aide: 'Des têtes dessinées sur ta tête, au lobby. Équipe-les avec le menu ✨ (case 1 du lobby).' },
  particules: { cle: 'UC_PARTICULE', nom: 'Particules', icone: 'cat-trainees', aide: 'Des effets autour de toi, dans tous les modes.' },
  familiers: { cle: 'UC_FAMILIER', nom: 'Familiers', icone: 'cat-compagnons', aide: 'Un animal qui te suit au lobby.' },
  gadgets: { cle: 'UC_GADGET', nom: 'Gadgets', icone: 'nether_star', aide: 'Des jouets à utiliser au lobby.' },
  montures: { cle: 'UC_MONTURE', nom: 'Montures', icone: 'nether_star', aide: 'Des montures à chevaucher au lobby.' },
  costumes: { cle: 'UC_COSTUME', nom: 'Costumes', icone: 'nether_star', aide: 'Un costume complet, au lobby.' },
  emotes: { cle: 'UC_EMOTE', nom: 'Émotes', icone: 'nether_star', aide: 'Des visages animés, au lobby.' },
  projectiles: { cle: 'UC_PROJECTILE', nom: 'Projectiles', icone: 'nether_star', aide: 'Une traînée derrière tes flèches, dans tous les modes.' },
  morts: { cle: 'UC_MORT', nom: 'Effets de mort', icone: 'nether_star', aide: 'Un effet quand tu tombes, dans tous les modes.' },
  fetes: { cle: 'FETE', nom: 'Fêtes', icone: 'nether_star', aide: 'Noël, Halloween, Pâques, Saint-Valentin : des packs à venir.' },
};
function categorieValide(c) {
  return Object.hasOwn(CATS, String(c || '')) ? String(c) : 'titres';
}

const EXPLICATIONS_TITRES = {
  titre_emissaire: "Quête de l'Émissaire des Mondes au Lobby (4 univers)",
  titre_fleau_divin: "Vaincre le Roi-Liche en difficulté Dieu (Donjon)",
  titre_liche: "Forge du Donjon (4 000 Âmes)",
  titre_donjon100: "Atteindre le niveau 100 du Donjon",
  titre_extraction100: "Atteindre le niveau 100 d'Extraction",
  titre_arene: "Tenir 40 vagues dans l'Arène du Donjon",
  titre_survivant: "Tenir 20 vagues dans l'Arène du Donjon (ou 500 💎)",
  titre_kamikaze: "Trophée : Exploser au combat en Duel",
  titre_favori: "Remporter 30 Duels 1v1",
  titre_employe: "Atteindre 10 quotas dans le mode Extraction",
  titre_veteran: "Survivre à 50 jours dans le mode Extraction",
  titre_forteresse: "Boutique du Tower Defense",
  titre_invaincu: "Boutique des Duels",
  titre_dracologue: "Quête du Chasseur de Dragons (Donjon)",
  titre_maitrise: "Quête de Maîtrise Niveau 50 (Chasseur de Dragons)",
  titre_abysses: "Quête : Le Maître des Abysses (Citadelle)",
  titre_foreur: "Quête : Le Foreur des Enfers (Citadelle)",
  titre_transmutateur: "Quête : Le Grand Transmutateur (Citadelle)",
  titre_marechal: "Quête : Le Maréchal de la Citadelle",
  titre_mythique: "Quête : Traqueur Mythique (Citadelle)",
  titre_archives: "Quête secrète des Archives (Hub du Donjon)",
  titre_chronique: "Dernier chapitre du Chroniqueur (Hub du Donjon)",
  titre_chasseur: "Quête de Chasseur de Têtes (Citadelle)",
  titre_warden: "Trophée : Vaincre le Gardien des Profondeurs (Warden)",
  titre_cauchemar: "Trophée : Terminer le Donjon en mode Cauchemar",
  titre_fouineur: "Trophée : Découvrir tous les passages secrets",
  titre_batisseur: "Boutique du Tower Defense (40 000 pièces)",
  titre_habitue: "Exclusif au grade Habitué",
  titre_vip: "Exclusif au grade VIP",
  titre_elite: "Exclusif au grade Élite",
  titre_legende_grade: "Exclusif au grade Légende",
  couleur_elite: "Exclusif au grade Élite",
  couleur_legende: "Exclusif au grade Légende",
};

const TITRES_AVEC_APERÇU = new Set([
  'titre_ardent', 'titre_arene', 'titre_batisseur', 'titre_donjon100', 'titre_elite',
  'titre_emissaire', 'titre_employe', 'titre_etoile', 'titre_extraction100', 'titre_favori',
  'titre_fleau_divin', 'titre_forteresse', 'titre_givre', 'titre_habitue', 'titre_invaincu',
  'titre_kamikaze', 'titre_legende', 'titre_legende_grade', 'titre_liche', 'titre_prestige_archere',
  'titre_prestige_assassin', 'titre_prestige_brute', 'titre_prestige_chevalier', 'titre_prestige_gladiateur',
  'titre_prestige_mage', 'titre_prestige_pyromane', 'titre_prestige_soigneur', 'titre_prestige_tireur',
  'titre_royal', 'titre_stratege', 'titre_survivant', 'titre_veteran', 'titre_vip'
]);

function explicationDeblocage(id) {
  if (EXPLICATIONS_TITRES[id]) return EXPLICATIONS_TITRES[id];
  if (String(id).startsWith('titre_prestige_')) return 'Passer Prestige 1 (Niv. 50) de cette classe';
  return '';
}

// Rareté affichée : d'après le prix en gemmes, ou l'endroit où l'objet se gagne.
function rarete(c) {
  if (c.monnaie === 'PIECES') return { cls: 'td', nom: 'Tower Defense' };
  if (c.monnaie === 'AMES') return { cls: 'donjon', nom: 'Donjon' };
  if (Number(c.prix) === 0) {
    if (String(c.id).startsWith('titre_prestige_')) return { cls: 'epique', nom: 'Prestige 50' };
    if (c.id === 'titre_emissaire') return { cls: 'legendaire', nom: 'Quête Ultime' };
    if (c.id === 'titre_fleau_divin') return { cls: 'legendaire', nom: 'Défi Dieu' };
    if (c.id.includes('grade') || c.id === 'titre_vip' || c.id === 'titre_elite' || c.id === 'titre_habitue' || c.id === 'couleur_elite' || c.id === 'couleur_legende') return { cls: 'exclusif', nom: 'Exclusif Grade' };
    return { cls: 'exclusif', nom: 'Quête en jeu' };
  }
  if (c.prix <= 500) return { cls: 'commun', nom: 'Commun' };
  if (c.prix <= 1500) return { cls: 'rare', nom: 'Rare' };
  if (c.prix <= 3000) return { cls: 'epique', nom: 'Épique' };
  return { cls: 'legendaire', nom: 'Légendaire' };
}

const SYMBOLES = { NOTE: '♪', HEART: '♥', SNOWFLAKE: '❄', FLAME: '✹', END_ROD: '✦', CHERRY_LEAVES: '❀', SOUL: '☾', ENCHANTED_HIT: '✧', FIREWORK: '✺',
  hats: '♛', particleeffects: '✧', pets: '❦', gadgets: '⚙', mounts: '♞', suits: '⚜', emotes: '☺', projectileeffects: '➶', deatheffects: '☠' };

// Aperçu d'un cosmétique : plaque de pseudo pour titres et couleurs ; image dessinée, icône du bloc, ou symbole sinon.
function visuelCosmetique(c, pseudo) {
  const nomJoueur = pseudo || 'Pseudo';
  const dessin = image(`cosmetiques/${c.id}`, '');
  if (dessin) return `<img class="cosm-image cosm-apercu" src="${dessin}" alt="${esc(c.nom)}" loading="lazy">`;
  if (c.categorie === 'COULEUR') return `<span class="plaque">${mm.span(c.id, c.valeur, nomJoueur)}</span>`;
  if (c.categorie === 'TITRE') return `<span class="plaque">${mm.span(c.id, c.valeur)}<span class="plaque-pseudo">${esc(nomJoueur)}</span></span>`;
  if (fs.existsSync(path.join(VID, `${c.id}.mp4`))) {
    return `<video class="cosm-video" src="/videos/${esc(c.id)}.mp4" autoplay loop muted playsinline disablepictureinpicture></video>`;
  }
  // Chapeau : le personnage en 3D avec le vrai bloc sur la tête, comme en jeu.
  const cle = String(c.valeur || '').toLowerCase();
  if (c.categorie === 'CHAPEAU' && Object.hasOwn(APERCUS.blocs, cle)) return apercuChapeau(cle);
  // Traînée : un personnage qui marche en laissant ses particules.
  if (c.categorie === 'TRAINEE' && Object.hasOwn(APERCUS.particules, c.valeur)) return apercuTrainee(c.valeur);
  const bloc = String(c.valeur || '').toLowerCase();
  if (/^[a-z_]+$/.test(bloc) && fs.existsSync(path.join(IMG, 'icones', `${bloc}.png`))) return `<img class="cosm-icone" src="/img/icones/${bloc}.png" alt="" width="64" height="64" loading="lazy">`;
  const PAR_CAT = { UC_CHAPEAU: '♛', UC_PARTICULE: '✧', UC_FAMILIER: '❦', UC_GADGET: '⚙', UC_MONTURE: '♞', UC_COSTUME: '⚜', UC_EMOTE: '☺', UC_PROJECTILE: '➶', UC_MORT: '☠', FETE: '✺' };
  return `<span class="cosm-symbole">${esc(SYMBOLES[c.valeur] || PAR_CAT[c.categorie] || '✦')}</span>`;
}

const FACES = '<i class="f-avant"></i><i class="f-arriere"></i><i class="f-droite"></i><i class="f-gauche"></i><i class="f-dessus"></i><i class="f-dessous"></i>';
function apercuChapeau(bloc) {
  const cube = (classe) => `<div class="cube ${classe}">${FACES}</div>`;
  return `<div class="apercu-perso" aria-hidden="true"><div class="ombre-sol"></div><div class="perso3d">${cube('c-jambe-g')}${cube('c-jambe-d')}${cube('c-bras-g')}${cube('c-bras-d')}${cube('c-torse')}${cube('c-tete')}${cube(`c-chapeau bloc-${bloc}${APERCUS.blocs[bloc].crane ? ' crane' : ''}`)}</div></div>`;
}
function apercuTrainee(particule) {
  return `<div class="apercu-trainee p-${particule}" aria-hidden="true"><div class="trainee-aura"></div><div class="trainee-symbole"></div><i class="trainee-etincelle e-1"></i><i class="trainee-etincelle e-2"></i><i class="trainee-etincelle e-3"></i></div>`;
}

function prixCosmetique(c) {
  if (c.monnaie === 'PIECES') return `${nombre(c.prix)} <small>pièces</small>`;
  if (c.monnaie === 'AMES') return `${nombre(c.prix)} <small>Âmes</small>`;
  return `${nombre(c.prix)} <small>gemmes</small>`;
}

function ongletsCosmetiques(base, cat, compter, ancre = '') {
  return `<nav class="onglets-cosm" aria-label="Catégories de cosmétiques">${Object.entries(CATS).map(([k, o]) => `<a href="${base}cat=${k}${ancre}" class="${k === cat ? 'actif' : ''}"><img src="${i(o.icone)}" alt="" width="28" height="28"><span>${esc(o.nom)}</span><em>${compter(o.cle)}</em></a>`).join('')}</nav>`;
}

const ONGLETS_BOUTIQUE = {
  grades: { nom: 'Grades', icone: () => image('site/onglet-grades', '/img/jeu/onglet-grades.png') },
  gemmes: { nom: 'Gemmes', icone: () => image('site/onglet-gemmes', '/img/jeu/onglet-gemmes.png') },
  cosmetiques: { nom: 'Cosmétiques', icone: () => image('site/onglet-cosmetiques', '/img/jeu/onglet-cosmetiques.png') },
};

function boutique(res, { onglet, cat: catDemandee, offres, catalogue, p, message: codeOk, erreur: codeErreur, id: idAchat }) {
  const achete = codeOk === 'achat' ? catalogue.find((c) => c.id === idAchat) : null;
  const message = achete ? `${achete.nom} : ${messageOk('achat').toLowerCase()}` : messageOk(codeOk);
  const erreur = messageErreur(codeErreur);
  const csrf = esc(res.locals.csrf);
  const s = res.locals.session;
  let contenu;

  if (onglet === 'gemmes') {
    const derniere = offres.offres.length - 1;
    contenu = `<div class="grille-offres">${offres.offres.map((o, k) => {
      const nbG = Number(o.gemmes) || parseInt(String((String(o.name).match(/[\d\s]+/) || [''])[0]).replace(/\s/g, ''), 10) || 0;
      const bonus = (String(o.name).match(/\+\s*([\d\s]+)\s*bonus/i) || [])[1];
      const visuel = image(`boutique/gemmes-${Math.min(6, k + 1)}`, nbG >= 18000 ? '/img/jeu/gemmes-coffre.png' : nbG >= 8000 ? '/img/jeu/gemmes-bourse.png' : '/img/jeu/gemmes-tas.png');
      const prix = Number(o.total_price ?? o.base_price ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: o.currency || 'EUR' });
      const tag = k === derniere ? '<span class="etiquette">Meilleure offre</span>' : o.meilleur ? '<span class="etiquette violet">Populaire</span>' : '';
      return `<div class="offre">${tag}
        <div class="offre-titre">${nombre(nbG)} <span>gemmes</span></div>
        <div class="offre-visuel"><img src="${visuel}" alt="" width="140" height="140" loading="lazy"></div>
        ${bonus ? `<div class="offre-bonus">+ ${esc(bonus.trim())} bonus</div>` : ''}
        <div class="offre-pied"><span class="prix">${esc(prix)}</span>
          ${s ? `<form method="post" action="/boutique/payer"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="offre" value="${esc(o.id)}"><button class="btn btn-petit" type="submit" ${offres.actif ? '' : 'disabled'}>${offres.actif ? 'Acheter' : 'Bientôt'}</button></form>`
            : `<a class="btn btn-petit" href="/connexion">${offres.actif ? 'Acheter' : 'Bientôt'}</a>`}</div>
      </div>`;
    }).join('')}</div>`;
  } else if (onglet === 'cosmetiques') {
    const cat = categorieValide(catDemandee);
    const visibles = (cle) => catalogue.filter((c) => {
      if (c.categorie !== cle) return false;
      if (cle === 'TITRE' && !TITRES_AVEC_APERÇU.has(c.id) && !(p && p.possedes.has(c.id))) return false;
      return c.prix > 0 || cle === 'TITRE' || cle === 'COULEUR' || cle === 'FETE' || (p && p.possedes.has(c.id));
    });
    const articles = visibles(CATS[cat].cle).sort((a, b) => {
      if (p) {
        const possedeA = p.possedes.has(a.id);
        const possedeB = p.possedes.has(b.id);
        if (possedeA !== possedeB) return possedeA ? -1 : 1;
      }
      return (a.monnaie === b.monnaie ? 0 : (a.monnaie || 'GEMMES') === 'GEMMES' ? -1 : 1) || a.prix - b.prix;
    });
    const possedesCat = p ? articles.filter((c) => p.possedes.has(c.id)).length : 0;
    contenu = `${ongletsCosmetiques('/boutique/cosmetiques?', cat, (cle) => visibles(cle).length)}
    <div class="tete-vitrine"><div><h2>${esc(CATS[cat].nom)}</h2><p>${esc(CATS[cat].aide)}</p></div>${p ? `<span class="pastille">${possedesCat} / ${articles.length} à toi</span>` : ''}</div>
    <div class="vitrine">${articles.map((c) => {
      const possede = p && p.possedes.has(c.id);
      const r = rarete(c);
      const enJeu = c.monnaie && c.monnaie !== 'GEMMES';
      const expl = explicationDeblocage(c.id);
      let action;
      if (String(c.valeur || '').startsWith('bientot:')) action = '<span class="actuel">Bientôt</span>';
      else if (possede) action = '<span class="actuel">Possédé</span>';
      else if (enJeu) action = `<span class="petit discret" title="${esc(expl)}">${esc(expl || 'À gagner en jeu')}</span>`;
      else if (Number(c.prix) === 0) action = `<span class="petit discret" title="${esc(expl)}">${esc(expl || 'À débloquer')}</span>`;
      else if (!s) action = '<a class="btn btn-contour btn-petit" href="/connexion">Connexion</a>';
      else action = `<form method="post" action="/boutique/cosmetique"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="id" value="${esc(c.id)}"><input type="hidden" name="cat" value="${cat}"><button class="btn btn-petit" type="submit" ${p && p.gemmes >= c.prix ? '' : 'disabled title="Pas assez de gemmes"'}>Acheter</button></form>`;
      return `<article class="cosm r-${r.cls} ${possede ? 'possede' : ''}">
        <div class="cosm-scene">${visuelCosmetique(c, p && p.pseudo)}<span class="rarete">${esc(r.nom)}</span></div>
        <div class="cosm-corps"><b>${esc(c.nom)}</b><div class="cosm-pied"><span class="cosm-prix">${Number(c.prix) === 0 ? 'En jeu' : prixCosmetique(c)}</span>${action}</div></div>
      </article>`;
    }).join('')}</div>`;
  } else {
    contenu = `<div class="grille-offres">${GRADES.map((g) => `<div class="offre grade g-${g.id}">
      ${g.tag ? `<span class="etiquette ${g.id === 'vip' ? 'violet' : ''}">${esc(g.tag)}</span>` : ''}
      <div class="offre-titre">Grade <span>${esc(g.nom)}</span></div>
      <div class="offre-visuel"><img src="${image(`site/grade-${g.id}`, `/img/jeu/grade-${g.id}.png`)}" alt="" width="110" height="130" loading="lazy"></div>
      <ul class="avantages">${g.avantages.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <div class="offre-pied"><span class="prix">${nombre(g.prix)} <small>gemmes</small></span>
        ${p && p.grade === g.id ? '<span class="actuel">Ton grade</span>' : '<span class="discret petit">En jeu : /boutique</span>'}</div>
    </div>`).join('')}</div>`;
  }

  const corps = `
${tetePage('Boutique officielle', 'Boutique', "Soutiens le serveur, débloque des privilèges exclusifs et personnalise ton style. Zéro pay-to-win dans les jeux.")}
<section class="page"><div class="enveloppe">
  <nav class="onglets-boutique" aria-label="Catégories de la boutique">${Object.entries(ONGLETS_BOUTIQUE).map(([k, o]) => `<a href="/boutique/${k}" class="${k === onglet ? 'actif' : ''}"><img src="${o.icone()}" alt="" width="42" height="42">${esc(o.nom)}</a>`).join('')}</nav>
  ${avis(message, 'succes')}${avis(erreur, 'erreur')}
  <div class="boutique">
    <div>
      ${onglet === 'gemmes' && !offres.actif ? '<div class="avis info"><span>Le paiement en ligne ouvre très bientôt. En attendant, les gemmes se gagnent en jouant, en votant et dans les coffres.</span></div>' : ''}
      ${onglet === 'grades' ? '<div class="avis info"><span>Les grades s\'achètent en gemmes, directement en jeu avec <b>/boutique</b>. Passer au grade suivant ne coûte que la différence.</span></div>' : ''}
      ${contenu}
    </div>
    <aside class="cote">
      <div class="panneau">
        <div class="panneau-tete"><h3>${s ? esc(s.pseudo) : 'Connexion'}</h3></div>
        <div class="panneau-corps">
          ${s ? `<span class="etiquette-section">Ton solde</span><div class="solde">${nombre(p ? p.gemmes : 0)} <small>gemmes</small></div>
            ${p && p.grade && p.grade !== 'default' ? `<p class="petit">Grade actuel : <span class="pastille ${esc(p.grade)}">${esc(NOMS_GRADES[p.grade] || p.grade)}</span></p>` : ''}
            <a class="btn btn-contour btn-plein" href="/compte">Mon compte</a>`
          : `<p class="petit">Connecte-toi avec ton pseudo Minecraft : les achats arrivent sur ce compte.</p>
            <form class="formulaire" method="get" action="/connexion">
              <input class="champ" type="text" name="pseudo" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" placeholder="Pseudo Minecraft" required aria-label="Pseudo Minecraft">
              <button class="btn btn-plein" type="submit">Se connecter</button>
            </form>
            <p class="petit discret">Compte officiel ? Tape <code>/site</code> en jeu pour un lien direct.</p>`}
        </div>
      </div>
      <div class="panneau panneau-corps garanties">
        <div><img src="${i('shield')}" alt="" width="28" height="28">Zéro pay-to-win, équité totale en jeu</div>
        <div><img src="${i('diamond')}" alt="" width="28" height="28">Livraison automatique en moins d'une minute</div>
        <div><img src="${i('book')}" alt="" width="28" height="28">Paiement sécurisé par Tebex, partenaire de Mojang</div>
      </div>
    </aside>
  </div>
</div></section>`;
  return page({ titre: `Boutique · ${ONGLETS_BOUTIQUE[onglet].nom}`, actif: 'boutique', corps, description: `Boutique ${NOM} : ${onglet === 'gemmes' ? 'packs de gemmes' : onglet === 'cosmetiques' ? 'titres, couleurs de pseudo, traînées, chapeaux et compagnons' : 'grades Habitué, VIP, Élite et Légende'}. 100 % cosmétique, aucun pay-to-win.`, jsonld: [seo.fil([['Boutique', '/boutique'], [ONGLETS_BOUTIQUE[onglet].nom, `/boutique/${onglet}`]])] }, res);
}

// ------------------------------------------------------------------ votes

function votes(res, { statut }) {
  const sites = Array.isArray(config.votes) ? config.votes.filter((v) => v && v.nom && /^https:\/\//.test(v.url || '')) : [];
  const corps = `
${tetePage('Soutenir le serveur', 'Voter', `Chaque vote fait monter ${NOM} dans les classements et te rapporte une clé du Coffre des votes, même hors ligne.`)}
<section class="page"><div class="enveloppe">
  <div class="grille-3">
    <div class="panneau carte-info"><img src="${image('site/vote-cle', '/img/jeu/cle-vote.png')}" alt="" width="84" height="84"><h3>1 vote = 1 clé</h3><p>La clé arrive sur ton compte, à ouvrir au lobby ou avec /quotidien.</p></div>
    <div class="panneau carte-info"><img src="${image('site/vote-coffre', '/img/jeu/coffre-vote.png')}" alt="" width="84" height="84"><h3>Le Coffre des votes</h3><p>Pièces, ressources, Âmes, gemmes, cosmétiques… et parfois la clé du Coffre Habitué.</p></div>
    <div class="panneau carte-info"><img src="${image('site/vote-horloge', '/img/jeu/horloge-vote.png')}" alt="" width="84" height="84"><h3>Toutes les 24 h</h3><p>La plupart des sites acceptent un vote par jour. Pense à revenir.</p></div>
  </div>
  <div class="tete-section marge-haut"><span class="etiquette-section">Sites de vote</span><h2>Vote pour ${esc(NOM)}</h2><p>Indique bien ton pseudo exact sur le site de vote.</p></div>
  ${sites.length ? `<div class="sites-vote">${sites.map((v, k) => `<div class="panneau site-vote"><span class="rang-vote">${k + 1}</span><div><b>${esc(v.nom)}</b><span class="discret petit">1 clé par vote</span></div><a class="btn btn-rose btn-petit" href="${esc(v.url)}" rel="noopener" target="_blank">Voter</a></div>`).join('')}</div>`
    : '<div class="panneau vide">Les sites de vote arrivent très bientôt.</div>'}
  <div class="appel marge-haut"><h2>Pas encore sur le serveur ?</h2><p>${enLigne(statut)}. Connecte-toi une première fois pour que tes votes soient comptés.</p>${ip()}</div>
</div></section>`;
  return page({ titre: 'Voter pour le serveur', actif: 'votes', corps, description: `Vote pour ${NOM} sur les sites de classement de serveurs Minecraft et gagne une clé du Coffre des votes à chaque vote.`, jsonld: [seo.fil([['Voter', '/votes']])] }, res);
}

// ------------------------------------------------------------------ wiki & commandes

function wiki(res) {
  const sections = [
    {
      id: 'general',
      titre: 'Commandes Générales & Réseau',
      icone: '🌐',
      description: 'Les commandes de base accessibles à tous les joueurs pour naviguer et gérer leur aventure.',
      commandes: [
        { cmd: '/jouer [mode]', desc: 'Ouvre le menu général des jeux ou rejoint directement un mode (td, lethal, donjon, lobby).', badge: 'Tous', tagClass: 'badge-tous', aliases: '/play' },
        { cmd: '/spawn', desc: 'Retourne instantanément au point d\'apparition principal du lobby.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/hub, /lobby' },
        { cmd: '/profil', desc: 'Consulte tes statistiques complètes, tes ratios de victoire et ton historique de jeu.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/stats' },
        { cmd: '/gemmes', desc: 'Affiche ton solde actuel de gemmes pour la boutique cosmétique.', badge: 'Tous', tagClass: 'badge-tous', aliases: '' },
        { cmd: '/quotidien', desc: 'Ouvre le menu des coffres quotidiens pour récupérer tes récompenses et clés gratuites chaque jour.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/daily' },
        { cmd: '/defis', desc: 'Affiche tes quêtes et défis du moment pour gagner des pièces et des gemmes.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/quetes' },
        { cmd: '/trophees', desc: 'Consulte les hauts faits débloqués sur le réseau et les titres de gloire associés.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/achievements' },
        { cmd: '/vote', desc: 'Affiche les liens pour voter pour le serveur et obtenir des clés de coffres de vote.', badge: 'Tous', tagClass: 'badge-tous', aliases: '' },
        { cmd: '/site', desc: 'Génère un code sécurisé à 6 chiffres pour associer ton compte en jeu sur le site web.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/lier' },
        { cmd: '/report <pseudo> <motif>', desc: 'Signale un joueur suspect, tricheur ou toxique en toute discrétion à l\'équipe de modération.', badge: 'Tous', tagClass: 'badge-tous', aliases: '' },
      ]
    },
    {
      id: 'cosmetiques',
      titre: 'Personnalisation & Cosmétiques',
      icone: '✨',
      description: 'Tout pour personnaliser l\'apparence de ton personnage sans aucun impact sur le gameplay.',
      commandes: [
        { cmd: '/cosmetiques', desc: 'Ouvre la garde-robe complète de tes cosmétiques possédés (chapeaux, particules, traînées, familiers, émotes).', badge: 'Tous', tagClass: 'badge-tous', aliases: '/uc, /wardrobe' },
        { cmd: '/boutique', desc: 'Ouvre le catalogue en jeu pour acheter de nouveaux cosmétiques avec tes gemmes ou monnaies de jeu.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/shop, /acheter' },
        { cmd: '/titres', desc: 'Affiche et équipe les titres prestigieux obtenus lors de tes victoires ou avec ton grade.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/titre' },
        { cmd: '/skin <pseudo/url>', desc: 'Change instantanément ton skin de joueur avec celui d\'un joueur ou d\'une URL.', badge: 'Tous', tagClass: 'badge-tous', aliases: '' },
        { cmd: '/skinmenu', desc: 'Parcours un menu visuel complet de skins populaires prêts à être équipés en un clic.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/skins' },
      ]
    },
    {
      id: 'modes',
      titre: 'Commandes des Modes de Jeu',
      icone: '🎮',
      description: 'Commandes interactives spécifiques à chacun de nos quatre modes originaux.',
      commandes: [
        { cmd: '/td', desc: 'Interface du Tower Defense : arbre des technologies, vote de difficulté et boutique de tourelles.', badge: 'Tower Defense', tagClass: 'badge-mode', aliases: '' },
        { cmd: '/escouade', desc: 'Gestion de ton groupe en mode Extraction : inviter des joueurs, choisir le leader et gérer la navette.', badge: 'Extraction', tagClass: 'badge-mode', aliases: '/squad' },
        { cmd: '/primes', desc: 'Consulte les contrats de prime du jour disponibles en Extraction et en Donjon.', badge: 'Extraction / Donjon', tagClass: 'badge-mode', aliases: '/contrats' },
        { cmd: '/donjon', desc: 'Ouvre le grimoire du Donjon : sélection de classe (Mage, Guerrier, etc.), compétences et Forge.', badge: 'Donjon', tagClass: 'badge-mode', aliases: '' },
        { cmd: '/duel <joueur>', desc: 'Lance un défi en 1 contre 1 à un autre joueur dans l\'arène de ton choix.', badge: '1 vs 1', tagClass: 'badge-mode', aliases: '/fight' },
      ]
    },
    {
      id: 'grades',
      titre: 'Commandes & Privilèges des Grades',
      icone: '👑',
      description: 'Les commandes et avantages réservés aux joueurs ayant débloqué un statut de prestige.',
      commandes: [
        { cmd: '/quotidien (Habitué)', desc: 'Débloque un Coffre Habitué quotidien gratuit (+2 gemmes par jour, pièces et récompenses).', badge: 'Habitué', tagClass: 'badge-habitue', aliases: 'Accessible en jouant' },
        { cmd: '/fly', desc: 'Permet de voler librement dans les airs au lobby pour admirer l\'architecture.', badge: 'VIP, Élite, Légende', tagClass: 'badge-vip', aliases: 'Lobby uniquement' },
        { cmd: '/skin (sans délai)', desc: 'Supprime totalement le temps d\'attente entre deux changements d\'apparence.', badge: 'VIP, Élite, Légende', tagClass: 'badge-vip', aliases: 'Instantané' },
        { cmd: '/glow', desc: 'Active ou désactive un contour lumineux éclatant autour de ton personnage.', badge: 'Élite & Légende', tagClass: 'badge-elite', aliases: 'Lobby' },
        { cmd: '/hat', desc: 'Place n\'importe quel bloc ou objet tenu dans ta main directement sur ta tête !', badge: 'Élite & Légende', tagClass: 'badge-elite', aliases: 'Lobby' },
        { cmd: '/sit', desc: 'Fait asseoir ton personnage n\'importe où sur le sol ou sur les marches (saute pour te relever).', badge: 'Élite & Légende', tagClass: 'badge-elite', aliases: 'Lobby' },
        { cmd: '/flyspeed <1-5>', desc: 'Règle ta vitesse de vol au lobby pour explorer à vitesse supersonique.', badge: 'Légende', tagClass: 'badge-legende', aliases: 'Lobby' },
        { cmd: '/quotidien (Légende)', desc: 'Coffre Légende chaque jour contenant +50 gemmes quotidiennes et des récompenses ultra rares.', badge: 'Légende', tagClass: 'badge-legende', aliases: 'Quotidien' },
      ]
    }
  ];

  const corps = `
${tetePage('Documentation & Commandes', 'Wiki des Commandes', 'Découvre l\'ensemble des commandes du serveur, les raccourcis essentiels et tous les privilèges des grades.')}

<section class="page"><div class="enveloppe">

  <div class="wiki-nav">
    <a href="#general">🌐 Générales</a>
    <a href="#cosmetiques">✨ Cosmétiques</a>
    <a href="#modes">🎮 Modes de jeu</a>
    <a href="#grades">👑 Grades & VIP</a>
  </div>

  ${sections.map((sec) => `
    <div class="section-wiki" id="${sec.id}">
      <div class="tete-section">
        <span class="etiquette-section">${esc(sec.titre.split(' ')[0])}</span>
        <h2>${sec.icone} ${esc(sec.titre)}</h2>
        <p>${esc(sec.description)}</p>
      </div>

      ${sec.id === 'grades' ? `
        <div class="banniere-grade-wiki vip">
          <div>
            <h3>Grade VIP</h3>
            <p>Vol au lobby, skin sans délai, préfixe vert, +8 gemmes/jour et slot prioritaire garanti.</p>
          </div>
          <a href="/boutique?cat=grades">Découvrir le VIP</a>
        </div>
        <div class="banniere-grade-wiki elite">
          <div>
            <h3>Grade Élite</h3>
            <p>Commandes /glow, /hat, /sit au lobby, titre dégradé, familier Panda, +20 gemmes/jour.</p>
          </div>
          <a href="/boutique?cat=grades">Découvrir l'Élite</a>
        </div>
        <div class="banniere-grade-wiki legende">
          <div>
            <h3>Grade Légende</h3>
            <p>Le statut ultime : titre doré animé, /flyspeed, aura divine, feux d'artifice à l'arrivée et +50 gemmes/jour.</p>
          </div>
          <a href="/boutique?cat=grades">Découvrir la Légende</a>
        </div>
      ` : ''}

      <div class="grille-commandes">
        ${sec.commandes.map((c) => `
          <div class="carte-cmd">
            <div>
              <div class="carte-cmd-haut">
                <code>${esc(c.cmd)}</code>
                <span class="badge-tag ${esc(c.tagClass)}">${esc(c.badge)}</span>
              </div>
              <p>${esc(c.desc)}</p>
            </div>
            <div class="carte-cmd-bas">
              <span>${c.aliases ? `Alias : <span class="carte-cmd-aliases">${esc(c.aliases)}</span>` : 'Commande directe'}</span>
              <span>${esc(NOM)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}

  <div class="appel marge-haut">
    <h2>Besoin d'aide supplémentaire ?</h2>
    <p>Notre communauté et l'équipe du serveur sont disponibles pour répondre à toutes tes questions.</p>
    <div class="actions actions-centre">
      ${DISCORD ? `<a class="btn btn-discord" href="${esc(DISCORD)}" target="_blank" rel="noopener">Rejoindre le Discord</a>` : ''}
      <a class="btn btn-contour" href="/#rejoindre">Comment nous rejoindre</a>
    </div>
  </div>

</div></section>`;

  return page({ titre: 'Wiki & Commandes du serveur', actif: 'wiki', corps, description: `Guide complet des commandes du serveur ${NOM} : commandes générales, cosmétiques, modes de jeu et commandes exclusives des grades VIP, Élite et Légende.`, jsonld: [seo.fil([['Wiki & Commandes', '/wiki']])] }, res);
}

// ------------------------------------------------------------------ formulaire de contact

function contact(res, { ok = false, erreur = '' } = {}) {
  const csrf = res.locals.csrf || '';
  const corps = `
${tetePage('Support & Contact', 'Nous contacter', 'Une question sur le serveur, un souci avec la boutique ou une proposition de partenariat ? Notre équipe te répond.')}
<section class="page"><div class="enveloppe grille-2">
  <div>
    <div class="panneau">
      <h3>Canaux directs</h3>
      <p>Tu peux nous joindre par email ou directement sur notre serveur Discord communautaire.</p>
      <p><b>Email officiel :</b> <a href="mailto:contact.orbis.server@gmail.com">contact.orbis.server@gmail.com</a></p>
      ${DISCORD ? `<p><b>Discord :</b> <a href="${esc(DISCORD)}" target="_blank" rel="noopener">Ouvrir un ticket Discord</a></p>` : ''}
      <hr class="separateur">
      <h4>Délais de réponse</h4>
      <p>Notre équipe traite l'ensemble des demandes sous 24 à 48 heures ouvrées.</p>
    </div>
  </div>
  <div>
    <div class="panneau">
      <h3>Envoyer un message</h3>
      ${ok ? '<div class="avis ok" role="status">Ton message a bien été envoyé ! Nous te répondrons par email très rapidement.</div>' : ''}
      ${erreur ? `<div class="avis erreur" role="alert">${esc(erreur)}</div>` : ''}
      <form method="POST" action="/contact">
        <input type="hidden" name="_csrf" value="${esc(csrf)}">
        <div class="champ">
          <label for="pseudo">Pseudo Minecraft (facultatif)</label>
          <input type="text" id="pseudo" name="pseudo" placeholder="Ex: Steve" maxlength="16">
        </div>
        <div class="champ">
          <label for="email">Ton adresse email <span class="requis">*</span></label>
          <input type="email" id="email" name="email" placeholder="ton.email@exemple.com" required maxlength="100">
        </div>
        <div class="champ">
          <label for="sujet">Sujet de ta demande <span class="requis">*</span></label>
          <select id="sujet" name="sujet" required>
            <option value="Question générale">Question générale</option>
            <option value="Problème boutique ou gemmes">Problème boutique ou gemmes</option>
            <option value="Signalement bug ou joueur">Signalement bug ou joueur</option>
            <option value="Partenariat ou Créateur de contenu">Partenariat ou Créateur de contenu</option>
          </select>
        </div>
        <div class="champ">
          <label for="message">Message <span class="requis">*</span></label>
          <textarea id="message" name="message" rows="5" placeholder="Explique-nous ta demande en détail..." required maxlength="2000"></textarea>
        </div>
        <button type="submit" class="btn btn-plein btn-grand">Envoyer mon message</button>
      </form>
    </div>
  </div>
</div></section>`;
  return page({ titre: 'Contact & Support', actif: 'contact', corps }, res);
}

// ------------------------------------------------------------------ pages légales

function legale(res, type) {
  let titrePage = 'Mentions légales';
  let blocs = '';

  if (type === 'cgv') {
    titrePage = 'Conditions Générales de Vente';
    blocs = `
      <h2>1. Objet</h2>
      <p>Les présentes Conditions Générales de Vente (CGV) régissent les transactions réalisées sur la boutique en ligne du serveur de jeu <b>${esc(NOM)}</b> (accessible sur <b>https://mcorbis.com/boutique</b>) ainsi qu'en jeu.</p>
      
      <h2>2. Vendeur et Marchand de Référence (Merchant of Record)</h2>
      <p>Tous les paiements en monnaie réelle (euros) effectués sur la boutique sont traités et encaissés exclusivement par <b>Tebex Limited</b> (enregistrée en Angleterre et au Pays de Galles sous le n° 08129264, siège : Tebex Limited, 7 Bell Yard, London, WC2A 2JR, Royaume-Uni). Tebex agit en qualité de revendeur officiel et marchand de référence légal, assumant la gestion de la facturation, de la TVA et de la conformité des transactions.</p>
      <p>En procédant au paiement, vous acceptez expressément les conditions générales d'utilisation et de vente de Tebex (<a href="https://www.tebex.io/legal/terms" target="_blank" rel="noopener">Conditions Tebex</a>).</p>

      <h2>3. Nature des biens vendus et Équité de jeu (EULA Mojang)</h2>
      <p>Les articles proposés sur la boutique d'OrbisMC consistent en :</p>
      <ul>
        <li>Une monnaie virtuelle interne appelée <b>« Gemmes »</b> ;</li>
        <li>Des éléments cosmétiques de personnalisation visuelle (titres colorés, auras, particules de traînée, chapeaux 3D) ;</li>
        <li>Des grades offrant des fonctionnalités de confort (accès prioritaire en cas de forte affluence, commandes de lobby, gemmes quotidiennes).</li>
      </ul>
      <p><b>Garantie stricte de non pay-to-win :</b> Conformément aux directives commerciales de Mojang Studios, aucun article ou grade ne confère d'avantage compétitif, de puissance de combat ou de bonus facilitant la victoire dans les modes de jeu.</p>
      <p>Les gemmes et cosmétiques n'ont aucune valeur monétaire dans le monde réel, ne constituent pas des instruments financiers et ne peuvent en aucun cas être échangés ou rachetés contre de l'argent réel.</p>

      <h2>4. Livraison</h2>
      <p>La livraison des gemmes ou articles numériques acquis est entièrement automatisée. Dès la confirmation de la transaction par Tebex, les éléments sont crédités sur le compte du joueur correspondant au pseudo Minecraft renseigné, en général en moins de 60 secondes.</p>

      <h2>5. Droit de rétractation et Contenu numérique</h2>
      <p>Conformément aux dispositions de l'article L. 221-28 du Code de la consommation, le droit de rétractation ne peut être exercé pour les contrats de fourniture d'un contenu numérique sans support matériel dont l'exécution a commencé avant la fin du délai de rétractation avec l'accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation.</p>

      <h2>6. Protection des mineurs</h2>
      <p>L'utilisation de la boutique par un joueur mineur implique nécessairement qu'il ait obtenu au préalable l'autorisation expresse de ses parents ou de son représentant légal avant toute transaction.</p>

      <h2>7. Contact et Service Client</h2>
      <p>Pour toute question ou réclamation relative à une commande, notre équipe d'assistance est joignable à : <a href="mailto:contact.orbis.server@gmail.com">contact.orbis.server@gmail.com</a>.</p>
    `;
  } else if (type === 'confidentialite') {
    titrePage = 'Politique de Confidentialité';
    blocs = `
      <h2>1. Introduction et Responsable du traitement</h2>
      <p>La protection de votre vie privée et de vos données personnelles est une priorité pour le serveur <b>${esc(NOM)}</b>. La présente politique détaille les données collectées lors de votre navigation sur le site web <b>https://mcorbis.com</b> et lors de votre connexion à nos serveurs de jeu Minecraft.</p>
      <p>Contact du responsable des données : <a href="mailto:contact.orbis.server@gmail.com">contact.orbis.server@gmail.com</a>.</p>

      <h2>2. Données collectées et Finalités</h2>
      <p>Nous limitons la collecte aux seules données strictement nécessaires au bon fonctionnement du service :</p>
      <ul>
        <li><b>Pseudo Minecraft et UUID :</b> Nécessaires pour identifier votre profil de joueur, sauvegarder votre progression, vos statistiques de jeu et vos éléments cosmétiques.</li>
        <li><b>Empreinte de mot de passe (comptes non officiels) :</b> Pour les joueurs utilisant un mot de passe de protection, celui-ci est transformé par un algorithme de hachage cryptographique fort à sens unique (Argon2 / SHA-256). Aucun mot de passe n'est jamais stocké en clair.</li>
        <li><b>Adresse IP et journaux techniques :</b> Journalisées temporairement à des fins exclusives de sécurité, de prévention des attaques par déni de service (DDoS) et de limitation des abus.</li>
        <li><b>Messages de contact :</b> Votre adresse email et votre message lorsque vous utilisez le formulaire de contact ou nous écrivez par email, uniquement pour vous répondre.</li>
      </ul>

      <h2>3. Données de paiement et Sécurité bancaire</h2>
      <p><b>${esc(NOM)} ne collecte, ne traite et ne stocke JAMAIS la moindre information bancaire ou numéro de carte de paiement.</b></p>
      <p>L'ensemble des règlements est traité directement sur l'infrastructure sécurisée et certifiée PCI-DSS de notre partenaire de paiement officiel <b>Tebex Limited</b> (ou PayPal / Stripe selon votre choix). Tebex nous transmet uniquement la confirmation de commande avec le pseudo du joueur et le montant acquis.</p>

      <h2>4. Cookies et Traceurs</h2>
      <p>Le site web d'OrbisMC applique une politique stricte de respect de la vie privée :</p>
      <ul>
        <li><b>Aucun cookie publicitaire</b> ni traceur de profilage ou de revente de données n'est utilisé.</li>
        <li>Un unique cookie technique de session sécurisé (<code>orbis_session</code>) est déposé sur votre terminal pour maintenir votre session active lorsque vous vous connectez.</li>
      </ul>

      <h2>5. Durée de conservation</h2>
      <p>Les données de jeu (statistiques, inventaires) sont conservées pendant toute la durée d'exploitation active du serveur. Les journaux de connexion technique sont purgés régulièrement.</p>

      <h2>6. Vos droits (RGPD)</h2>
      <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez à tout moment d'un droit d'accès, de rectification et d'effacement de vos données personnelles. Vous pouvez exercer ce droit à tout moment par simple email à : <a href="mailto:contact.orbis.server@gmail.com">contact.orbis.server@gmail.com</a>.</p>
    `;
  } else {
    // Mentions légales (LCEN)
    titrePage = 'Mentions Légales';
    blocs = `
      <h2>1. Édition du site</h2>
      <p>Le site internet accessible à l'adresse <b>https://mcorbis.com</b> est édité et administré par l'équipe communautaire du projet <b>${esc(NOM)}</b>.</p>
      <p>Conformément aux dispositions de l'article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), les éditeurs d'un service de communication au public en ligne non professionnel peuvent préserver leur anonymat en indiquant les coordonnées de leur hébergeur, sous réserve que leur identification civile complète ait été préalablement transmise à ce dernier.</p>
      <p><b>Adresse email de contact officielle :</b> <a href="mailto:contact.orbis.server@gmail.com">contact.orbis.server@gmail.com</a></p>

      <h2>2. Hébergement du site web</h2>
      <p>Le site internet <b>mcorbis.com</b> est hébergé dans une infrastructure cloud sécurisée par :</p>
      <p><b>Vercel Inc.</b><br>
      440 N Barranca Ave #4133<br>
      Covina, CA 91723, États-Unis<br>
      Site web : <a href="https://vercel.com" target="_blank" rel="noopener">https://vercel.com</a></p>

      <h2>3. Infrastructure des serveurs de jeu</h2>
      <p>Les serveurs de jeu multijoueur OrbisMC sont hébergés sur des infrastructures dédiées sécurisées situées au sein de l'Union Européenne.</p>

      <h2>4. Propriété intellectuelle et Affiliation Mojang</h2>
      <p>Minecraft est une marque déposée appartenant à <b>Mojang Synergies AB / Microsoft Corporation</b>.</p>
      <p><b>${esc(NOM)} est un service indépendant et n'est en aucun cas affilié, approuvé, soutenu ou associé à Mojang Synergies AB ou Microsoft Corporation.</b> Tous les modèles, graphismes originaux, logos et codes développés spécifiquement pour le réseau OrbisMC sont la propriété exclusive de leurs auteurs respectifs.</p>
    `;
  }

  const corps = `${tetePage('Informations', titrePage, '')}<section class="page"><div class="enveloppe texte-long">${blocs}</div></section>`;
  return page({ titre: titrePage, corps }, res);
}

module.exports = { categorieValide, accueil, jeu, classements, joueur, introuvable, connexion, compte, boutique, votes, legale, contact, wiki, definirCatalogue, ONGLETS, JEUX, ONGLETS_BOUTIQUE };


