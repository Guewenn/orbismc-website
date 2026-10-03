// Les pages du site. Tout ce qui vient de la base ou du visiteur passe par esc() (ou mm.span, qui échappe aussi).
// Aucun style en ligne : la politique de sécurité l'interdit, tout est dans /css/site.css.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { esc, nombre, duree, date } = require('./html');
const mm = require('./mm');
const { NOMS_GRADES } = require('./donnees');
const seo = require('./seo');
const { lienSur } = require('./securite');
const { iconeSvg } = require('./icones');
const CHAPEAUX = require('./chapeaux.json');
const VISUELS_COSMETIQUES = require('./visuels-cosmetiques.json');
const packs = require('./packs');

// Lien Discord de la configuration, accepté seulement en https.
const DISCORD = lienSur(config.discord);
const YOUTUBE = lienSur(config.youtube);
const TIKTOK = lienSur(config.tiktok);

// Messages affichés après une action : l'adresse ne transporte qu'un code, jamais un texte libre.
const MESSAGES = {
  ok: {
    achat: 'Acheté. Titres et couleurs équipés ; autres cosmétiques à activer dans le menu en jeu après reconnexion.',
    equipe: 'Équipé. Visible à ta prochaine arrivée sur un serveur.',
    merci: 'Merci pour ton soutien ! Après confirmation du paiement, Tebex transmet ta commande au serveur.',
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
    base: 'Le serveur est temporairement indisponible. Réessaie dans un instant.',
  },
};
const messageOk = (code) => (Object.hasOwn(MESSAGES.ok, code) ? MESSAGES.ok[code] : '');
const messageErreur = (code) => (Object.hasOwn(MESSAGES.erreur, code) ? MESSAGES.erreur[code] : '');

const NOM = config.nomServeur;
const IMG = path.join(__dirname, '..', 'public', 'img');
const VID = path.join(__dirname, '..', 'public', 'videos');
const i = (nom) => (fs.existsSync(path.join(IMG, 'icones', `${nom}.svg`)) ? `/img/icones/${nom}.svg` : `/img/icones/${nom}.png`);
/*
 * Version des fichiers statiques : une empreinte du CONTENU, pas la date de modification.
 * La date ne marche pas en déploiement : git ne conserve pas les mtimes, et le cache de build de Vercel
 * peut rendre deux déploiements successifs identiques de ce point de vue. C'est arrivé : le CSS de la page
 * contact avait changé, l'URL « site.css?v=… » non, et tous les navigateurs ont continué à servir l'ancienne
 * feuille pendant que le serveur renvoyait la nouvelle — page sans aucune mise en forme.
 * Une empreinte du contenu change si et seulement si le fichier change : jamais de cache périmé, et pas de
 * cassage de cache inutile quand rien n'a bougé.
 */
const empreintes = new Map();
const version = (fichier) => {
  if (empreintes.has(fichier)) return empreintes.get(fichier);
  let v = '0';
  try {
    v = crypto.createHash('sha1').update(fs.readFileSync(path.join(__dirname, '..', 'public', fichier))).digest('base64url').slice(0, 10);
  } catch { /* fichier absent : on laisse « 0 » */ }
  empreintes.set(fichier, v);
  return v;
};
const APERCUS = require('./apercus.json');
const V_APERCUS = version('css/apercus.css');
const V_CSS = version('css/site.css'), V_JS = version('js/site.js'), V_SCENE = version('img/scene.svg');

// Une vraie image déposée dans public/img remplace automatiquement le dessin par défaut.
function image(nom, defaut) {
  for (const ext of ['webp', 'jpg', 'png', 'svg']) {
    const rel = `img/${nom}.${ext}`;
    if (fs.existsSync(path.join(IMG, `${nom}.${ext}`)) && fs.statSync(path.join(IMG, `${nom}.${ext}`)).size > 32) return `/${rel}?v=${version(rel)}`;
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
    resume: 'Bâtis ta défense sur une île, repousse les vagues et pars miner pour débloquer de nouvelles tours.', genre: 'Stratégie & construction', format: 'Solo · raids', detail: '9 tours à maîtriser',
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
    num: '02', nom: 'Lethal Craft', court: 'Ramène la ferraille. Vivant.', accroche: 'Ramène la ferraille. Vivant.',
    resume: 'Explore des lunes hostiles avec ton équipage. Rapporte la ferraille avant que le vaisseau ne reparte sans toi.', genre: 'Survie & exploration', format: '1 à 4 joueurs', detail: 'Extraction avant minuit',
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
    resume: 'Choisis ta classe, rassemble ton escouade et descends dans les profondeurs jusqu’au Roi-Liche.', genre: 'Aventure coopérative', format: '1 à 4 joueurs', detail: '12 niveaux à explorer',
    texte: 'Forme ton escouade, choisis ta classe et descends. Douze niveaux générés à chaque partie, des pièges, des embuscades, des Âmes à gagner sur chaque monstre et à dépenser à la Forge. Et au fond, le Roi-Liche.',
    points: ['Cinq classes : Chevalier, Archère, Mage, Gladiateur, Soigneur', 'Douze niveaux générés : Cryptes, Mines oubliées, Forteresse infernale', 'Les Âmes : gagnées en combattant, dépensées à la Forge de ta classe', 'Champions, pièges et embuscades… puis le Roi-Liche'],
    badges: [['golden_sword', '5 classes'], ['amethyst_shard', 'Âmes et Forge'], ['totem_of_undying', 'Le Roi-Liche']],
    fonctions: [
      ['shield', 'Cinq classes', 'Chevalier au bouclier, Archère rapide, Mage et ses éclairs, Gladiateur au trident ou Soigneur pour soutenir l’escouade.'],
      ['compass', 'Douze niveaux', 'Générés à chaque partie, du 1.1 au 4.3, avec un bestiaire qui change à chaque palier.'],
      ['amethyst_shard', 'Les Âmes', 'Chaque monstre en donne à toute l’escouade. Elles se gardent d’une expédition à l’autre.'],
      ['golden_apple', 'La Forge', 'Armes, enchantements, armure et consommables propres à ta classe.'],
      ['tnt', 'Pièges et embuscades', 'Dalles piégées, coffres qui réveillent une vague, champions brillants.'],
      ['totem_of_undying', 'Le Roi-Liche', 'Au dernier niveau, avec sa barre de vie et sa furie à mi-vie.'],
    ],
    // « donjon_vitesse » n'est pas un nombre de secondes mais un SCORE : 21600 − durée de la descente
    // (le classement trie du plus grand au plus petit). On refait la soustraction pour afficher le chrono.
    classements: [['donjon_victoires', 'Rois-Liches vaincus', (v) => nombre(v)], ['donjon_etage', 'Niveau atteint', (v) => nombre(v)], ['donjon_monstres', 'Monstres vaincus', (v) => nombre(v)], ['donjon_vitesse', 'Descente la plus rapide', (v) => duree((21600 - Number(v)) * 1000)]],
  },
  duel: {
    num: '04', nom: '1 vs 1', court: 'Le premier qui… gagne.', accroche: 'Le premier qui… gagne.',
    resume: 'Un objectif, deux joueurs, dix minutes. Explore, fabrique et termine le défi avant ton adversaire.', genre: 'Course de survie', format: '2 joueurs · sans PvP', detail: '10 minutes pour gagner',
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
  { id: 'habitue', nom: 'Habitué', prix: 500, prixEuros: null, resume: 'Le premier palier, à gagner en jouant.', avantages: ['100% accessible en jouant et en votant', 'Préfixe [Habitué] et titre officiel « Habitué »', '+2 gemmes par jour (/quotidien)', 'Une clé du Coffre Habitué chaque jour', 'Rôle Discord'] },
  { id: 'vip', nom: 'VIP', prix: 7500, prixEuros: 12.99, tag: 'Populaire', resume: 'Priorité, vol et cosmétiques exclusifs.', avantages: ['Tout le Habitué inclus', 'Préfixe [VIP] vert', '+8 gemmes par jour (/quotidien)', 'Une clé du Coffre VIP chaque jour', 'Titre officiel « VIP » et couronne en or exclusifs', 'Vol au lobby et mise à jour de skin', 'Accès prioritaire si le serveur est plein', 'Rôle Discord VIP'] },
  { id: 'elite', nom: 'Élite', prix: 18000, prixEuros: 29.99, resume: 'Dégradé, cosmétiques débloqués et commandes lobby.', avantages: ['Tout le VIP inclus', 'Préfixe [Élite] bleu ciel', '+20 gemmes par jour (/quotidien)', 'Une clé du Coffre Élite chaque jour', 'Titre prestige « Élite », dégradé de pseudo, familier Panda et particule Enchanté exclusifs', 'Ailes arc-en-ciel, Ailes d’Ange, Super Héros, Infernal et Hélix de sang débloqués', 'Commandes lobby /glow, /hat <bloc>, /sit', 'Accès prioritaire quand le serveur est plein (hérité du VIP)'] },
  { id: 'legende', nom: 'Légende', prix: 38000, prixEuros: 49.99, tag: 'Prestige', resume: 'Le grade ultime : doré, animé, sonore et permanent.', avantages: ['Tout l’Élite inclus', 'Préfixe [Légende] doré suprême', '+50 gemmes par jour (/quotidien)', 'Une clé du Coffre Légende chaque jour', 'Titre doré, dégradé animé, Halo divin, chapeau Ange et familier Renifleur exclusifs', 'Annonce sonore et feux d’artifice à l’arrivée', 'Vol rapide réglable /flyspeed (1 à 5) et Halo divin au lobby', 'Place réservée garantie même si le serveur est complet (100%)'] },
];

// ------------------------------------------------------------------ gabarit

const LOGO = () => image('marque/logo-perso', `/img/marque/logo.svg?v=${version('img/marque/logo.svg')}`);

function page({ titre: titrePage, actif = '', corps, description = '', indexer = true, rechercheInterne = false, jsonld = [], image: imagePartage = '/img/og.png', largeurImage=1200, hauteurImage=630, altImage=`${NOM}, serveur Minecraft` }, res) {
  const req = res.req;
  /*
   * Trois cas, et le troisième est celui qui fait vivre le référencement :
   *  - page personnelle ou visiteur connecté : jamais en cache partagé ;
   *  - page publique qui porte un jeton anti-CSRF (connexion, contact) : revalidée à chaque fois ;
   *  - page publique sans formulaire (accueil, jeux, classements, mentions…) : mise en cache par le CDN.
   * Sans ce troisième cas, chaque visite de la page d'accueil réveillait une fonction serverless et tentait
   * une connexion à la base : le temps de réponse plombait les Core Web Vitals, donc le classement Google.
   * « Vary: Cookie » garantit qu'un visiteur connecté ne reçoit jamais la copie anonyme.
   */
  const porteUnJeton = corps.includes('name="_csrf"');
  if (!indexer || res.locals.session) res.set('Cache-Control', 'private, no-store');
  else if (porteUnJeton) res.set('Cache-Control', 'private, no-cache');
  else res.set({ 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400', Vary: 'Cookie, Accept-Encoding' });
  if (!indexer) res.set('X-Robots-Tag', 'noindex, nofollow');
  else if(rechercheInterne) res.set('X-Robots-Tag','noindex, follow');
  const titreComplet = titrePage ? `${titrePage} · ${NOM}` : `Serveur Minecraft français : 4 jeux sans mod · ${NOM}`;
  const descriptionFinale = description || `Découvre ${NOM}, serveur Minecraft Java français : Tower Defense, Lethal Craft, Donjon coop et défis 1 vs 1. Gratuit, sans mod. IP : ${config.adresseJeu}.`;
  const canonique = seo.url(seo.cheminCanonique(req?.path||'/',req?.query||{},Object.keys(CATS)));
  const avecApercus = corps.includes('apercu-perso') || corps.includes('apercu-trainee');
  const avecCouleurs = corps.includes('class="mm mm-');
  const s = res.locals.session;
  const lien = (href, texte, cle) => `<a href="${href}" class="${actif === cle ? 'actif' : ''}">${texte}</a>`;
  const jeux = Object.entries(JEUX).map(([id, j]) => `<a href="/jeux/${id}"><img src="${image(`site/scene-${id}-carte`, `/img/jeu/mode-${id}.png`)}" alt="" width="48" height="48"><span><b>${esc(j.nom)}</b><small>${esc(j.genre)}</small></span></a>`).join('');
  const compte = s ? `<a class="btn btn-contour btn-petit" href="/compte">${esc(s.pseudo)}</a>` : '<a class="btn btn-contour btn-petit" href="/connexion">Connexion</a>';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreComplet)}</title>
<meta name="description" content="${esc(descriptionFinale.slice(0, 300))}">
<meta name="author" content="${esc(NOM)}">
<meta name="robots" content="${indexer ? rechercheInterne?'noindex, follow':'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow'}">
${indexer ? `<link rel="canonical" href="${esc(canonique)}">` : ''}
<meta name="theme-color" content="#5b2fd1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(NOM)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(titreComplet)}">
<meta property="og:description" content="${esc(descriptionFinale.slice(0, 300))}">
<meta property="og:url" content="${esc(canonique)}">
<meta property="og:image" content="${esc(seo.url(imagePartage))}">
<meta property="og:image:width" content="${largeurImage}">
<meta property="og:image:height" content="${hauteurImage}">
<meta property="og:image:alt" content="${esc(altImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titreComplet)}">
<meta name="twitter:description" content="${esc(descriptionFinale.slice(0, 200))}">
<meta name="twitter:image" content="${esc(seo.url(imagePartage))}">
<meta name="twitter:image:alt" content="${esc(altImage)}">
<link rel="apple-touch-icon" href="/img/marque/embleme-180.png">
<link rel="manifest" href="/site.webmanifest">
${jsonld.map((o) => seo.jsonLd(o)).join('\n')}
<link rel="preload" href="/fonts/lilita-one-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=${V_CSS}">
${avecCouleurs?'<link rel="stylesheet" href="/css/cosmetiques.css">':''}
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
      <a href="/rejoindre">Guide pour jouer</a><a href="/classements">Classements</a><a href="/votes">Voter</a><a href="/boutique">Boutique</a><a href="/wiki">Wiki & Commandes</a><a href="/contact">Contact</a>
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
    <div><h4>Communauté</h4><a href="/wiki">Wiki & Commandes</a><a href="/classements">Classements</a><a href="/votes">Voter</a><a href="/contact">Contact & Support</a>${DISCORD ? `<a href="${esc(DISCORD)}" rel="noopener">Discord</a>` : ''}${YOUTUBE ? `<a href="${esc(YOUTUBE)}" target="_blank" rel="noopener">YouTube</a>` : ''}${TIKTOK ? `<a href="${esc(TIKTOK)}" target="_blank" rel="noopener">TikTok</a>` : ''}</div>
    <div><h4>Compte & Légal</h4><a href="/rejoindre">Guide pour jouer</a><a href="/boutique">Boutique</a><a href="/compte">Mon compte</a><a href="/inscription">Créer mon compte</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité (RGPD)</a><a href="/cgv">Conditions de vente</a></div>
  </div>
  <div class="mentions"><span>© ${new Date().getFullYear()} ${esc(NOM)}</span><span>${esc(NOM)} n'est pas un produit officiel de Minecraft. Ni approuvé par Mojang ou Microsoft, ni associé à eux.</span></div>
</div></footer>
<div class="barre-rapide" id="barreRapide" aria-label="Rejoindre rapidement">
  <div class="enveloppe barre-rapide-contenu">
    <div class="barre-rapide-info">
      <span class="point vivant"></span>
      <span class="barre-rapide-titre">OrbisMC <code>${esc(config.adresseJeu)}</code></span>
      <span class="barre-rapide-desc">Java ${esc(config.versionJeu)} · 4 jeux originaux</span>
    </div>
    <div class="barre-rapide-actions">
      <button type="button" class="btn btn-petit btn-ip-rapide" data-copier-texte="${esc(config.adresseJeu)}">${iconeSvg('copy', 15)} Copier l'IP</button>
      ${DISCORD ? `<a class="btn btn-discord btn-petit" href="${esc(DISCORD)}" target="_blank" rel="noopener">Discord</a>` : ''}
    </div>
  </div>
</div>
<div id="toastCopie" class="toast-copie" role="status" aria-live="polite">${iconeSvg('check', 18)} <span>IP copiée ! Prêt à jouer sur <b>${esc(config.adresseJeu)}</b></span></div>
</body>
</html>`;
}

function avis(texte, type = '') {
  return texte ? `<div class="avis ${type}" role="${type === 'erreur' ? 'alert' : 'status'}">${esc(texte)}</div>` : '';
}

function tableau(lignes, formater = (v) => nombre(v), depart = 0) {
  if (!lignes || !lignes.length) return '<div class="vide">Personne encore. La première place est libre.</div>';
  return `<table class="classement"><tbody>${lignes.map((l, k) => `<tr><td class="rang">#${depart + k + 1}</td>`
    + `<td>${lienJoueur(l)}${titre(l.titre)}</td><td class="valeur">${formater(l.valeur)}</td></tr>`).join('')}</tbody></table>`;
}

function ip(classe = '') {
  const discordUrl = DISCORD || 'https://discord.gg/Xeg7AH3X9B';
  if (!config.ouvert) {
    return `<div class="ip ip-bientot ${classe}"><span class="badge-bientot"><i class="point-pulse"></i>Bientôt disponible</span><a class="btn-ip-discord" href="${esc(discordUrl)}" target="_blank" rel="noopener"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028z"/></svg>Rejoindre le Discord</a></div>`;
  }
  return `<div class="ip ${classe}"><span class="ip-etiquette">IP :</span><code>${esc(config.adresseJeu)}</code><button type="button" data-copier title="Copier l'adresse IP du serveur">${iconeSvg('copy', 15)} Copier</button></div>`;
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

const FAQ_ACCUEIL = [
  ['Quelle est l’adresse IP pour rejoindre OrbisMC ?', `L'adresse IP officielle est ${config.adresseJeu} (port standard 25565). Il suffit de la copier et de l'ajouter dans la liste Multijoueur de ton jeu Minecraft Java.`],
  ['Quelles versions de Minecraft sont compatibles ?', `Le serveur accueille Minecraft Java ${config.versionJeu}. Utilise une version de cette plage pour rejoindre tes amis.`],
  ['Faut-il installer des mods ou un launcher modifié ?', 'Aucun mod ni launcher spécifique n’est requis. Le serveur propose son pack de ressources à la connexion ; accepte-le pour afficher les modèles et les menus personnalisés.'],
  ['Les comptes sans licence officielle peuvent-ils jouer ?', 'Oui, les comptes officiels et alternatifs sont acceptés. Un système d’authentification sécurisé protège ton pseudo, ton inventaire, tes statistiques et tes gemmes dès ta première connexion.'],
  ['Le serveur est-il pay-to-win ?', 'Non, équité totale et absolue. Aucune arme, armure surpuissante ou bonus de combat ne s’achète avec de l’argent réel. Les grades et gemmes débloquent uniquement du confort (vol au lobby, accès prioritaire) et des cosmétiques prestigieux.'],
  ['Comment jouer avec mes amis en équipe ?', 'Tu peux créer une escouade jusqu\'à 4 joueurs en mode Lethal Craft ou Donjon avec la commande /escouade, défier n\'importe qui en duel 1v1 avec /duel, ou construire et défendre côte à côte en Tower Defense.'],
];

function accueil(res, { statut, chiffres, topElo, topVague, topQuotas, equipe, records }) {
  const defile = ['Gratuit', `Java ${config.versionJeu}`, 'Sans pay-to-win', '4 jeux originaux', '0 mod à installer', config.ouvert ? config.adresseJeu : 'Ouverture prochaine sur Discord'];
  const corps = `
<section class="heros"><div class="enveloppe bento">
  <a class="tuile tuile-boutique" href="/boutique">
    <span class="grand-mot">Boutique</span>
    <span class="sous">Grades &amp; cosmétiques équitables</span>
    <img src="${image('boutique/gemmes-5', '/img/jeu/icone-coffre.png')}" alt="Un coffre de gemmes OrbisMC" width="300" height="300" decoding="async">
  </a>
  <div class="tuile tuile-banniere">
    <img class="fond" src="${image('scene', `/img/scene.svg?v=${V_SCENE}`)}" alt="" width="1920" height="1080">
    <div class="banniere-contenu">
    <img class="logo" src="${LOGO()}" alt="${esc(NOM)}" width="320" height="145">
    <h1>Le Serveur Minecraft Français aux <span>Quatre Jeux Inédits</span></h1>
    <div class="banniere-actions">
      <a class="btn btn-blanc" href="#rejoindre">Jouer maintenant</a>
      <a class="btn btn-contour-blanc" href="#jeux">Découvrir les 4 modes</a>
    </div>
    </div>
  </div>
  <div class="tuile tuile-jouer" id="rejoindre">
    <span class="grand-mot">${config.ouvert ? 'Rejoindre le serveur' : 'Rejoindre'}</span>
    <span class="sous">${enLigne(statut)} · Java ${esc(config.versionJeu)}</span>
    ${ip('ip-hero')}
    <div class="jouer-garanties">
      <span>${iconeSvg('check', 14)} 100% Gratuit</span>
      <span>${iconeSvg('check', 14)} Zéro mod</span>
      <span>${iconeSvg('check', 14)} 4 modes</span>
    </div>
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

<section class="section section-atouts"><div class="enveloppe">
  <div class="tete-section">
    <span class="etiquette-section">L'expérience OrbisMC</span>
    <h2>Pourquoi choisir notre serveur ?</h2>
    <p>Une nouvelle façon de jouer à Minecraft en multijoueur, axée sur la stratégie, l'originalité et le fair-play absolu.</p>
  </div>
  <div class="grille-4">
    <div class="panneau atout-carte">
      <div class="atout-icone">${iconeSvg('gamepad', 28)}</div>
      <h3>4 Jeux Inédits</h3>
      <p>Tower Defense stratégique, Lethal Craft en coop spatiale, Donjon RPG avec Forge et Duels 1v1. Du contenu codé sur mesure.</p>
    </div>
    <div class="panneau atout-carte">
      <div class="atout-icone">${iconeSvg('zap', 28)}</div>
      <h3>0 Mod Requis</h3>
      <p>Connecte-toi avec ton client Java officiel habituel. Notre pack de ressources haute définition s'applique automatiquement.</p>
    </div>
    <div class="panneau atout-carte">
      <div class="atout-icone">${iconeSvg('shield', 28)}</div>
      <h3>100% Fair-Play</h3>
      <p>Aucun pay-to-win. Seul le talent, la tactique et le jeu d'équipe font la différence pour grimper dans les classements.</p>
    </div>
    <div class="panneau atout-carte">
      <div class="atout-icone">${iconeSvg('server', 28)}</div>
      <h3>Conçu pour jouer ensemble</h3>
      <p>Quatre modes originaux, une progression sauvegardée et des escouades pour retrouver tes amis.</p>
    </div>
  </div>
</div></section>

<section class="section" id="jeux"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Modes de jeu</span><h2>Quatre univers, un seul serveur</h2>
  <p>Ton grade, tes gemmes et tes cosmétiques te suivent partout. Passe d'un jeu à l'autre en un éclair depuis le lobby principal. <a class="lien" href="/rejoindre">Comment rejoindre OrbisMC ?</a></p></div>
  <div class="grille-jeux">${Object.entries(JEUX).map(([id, j]) => {
    const capture = captures(id)[0];
    return `<article class="carte-jeu ${id}">
    <a class="visuel" href="/jeux/${id}" aria-label="Découvrir ${esc(j.nom)}"><img src="${capture||image(`site/scene-${id}-carte`, `/img/jeu/mode-${id}.png`)}" alt="${capture?'Capture':'Illustration'} de ${esc(j.nom)}" width="800" height="400" loading="lazy">
      <span class="badge carte-genre">${esc(j.genre)}</span><span class="carte-numero" aria-hidden="true">${j.num}</span></a>
    <div class="corps"><h3><a href="/jeux/${id}">${esc(j.nom)}</a></h3><div class="accroche">${esc(j.accroche)}</div><p>${esc(j.resume)}</p>
      <div class="carte-reperes"><span>${iconeSvg('users',16)}${esc(j.format)}</span><span>${iconeSvg('compass',16)}${esc(j.detail)}</span></div>
      <div class="actions"><a class="btn btn-petit" href="/jeux/${id}">Découvrir le jeu ${iconeSvg('arrow-right',16)}</a><a class="lien" href="#rejoindre">Rejoindre</a></div></div>
  </article>`;
  }).join('')}</div>
  <div class="grille-2 marge-haut">
    <article class="jeu-conseil">${iconeSvg('compass',36)}<div><h3>Ton premier voyage</h3><p>${config.ouvert?'Visite':'À l’ouverture, visite'} les quatre univers avec <code>/decouverte</code> et gagne le titre Éclaireur des Mondes. <a class="lien" href="/wiki#general">Découvrir le parcours</a></p></div></article>
    <article class="jeu-conseil">${iconeSvg('cat-trainees',36)}<div><h3>Le Trône de Givre</h3><p>Le rendez-vous coopératif du lobby : affrontez le Roi-Liche ensemble, le samedi à 21 h, heure de Paris. <a class="lien" href="/wiki#general">Préparer l’assaut</a></p></div></article>
  </div>
</div></section>

<section class="section section-blanche"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">${esc(NOM)} en chiffres</span><h2>Une communauté passionnée</h2><p>${chiffres.disponible===false?'Les statistiques de jeu seront affichées dès le raccordement du serveur.':'Statistiques enregistrées sur l’ensemble de nos modes, avec actualisation régulière.'}</p></div>
  <div class="boite-chiffres">
    <div class="chiffre fort"><b class="nb">${statut.enLigne ? nombre(statut.joueurs) : '0'}</b><span>joueurs en ligne</span><a class="btn btn-blanc btn-petit" href="#rejoindre">Rejoindre</a></div>
    <div class="chiffre"><b class="nb">${chiffres.disponible===false?'—':nombre(chiffres.joueurs)}</b><span>joueurs inscrits</span></div>
    <div class="chiffre"><b class="nb">${chiffres.disponible===false?'—':nombre(chiffres.heures)}</b><span>heures de jeu</span></div>
    <div class="chiffre"><b class="nb">${chiffres.disponible===false?'—':nombre(chiffres.monstresDonjon)}</b><span>monstres vaincus en Donjon</span></div>
  </div>
</div></section>

<section class="section" id="grades"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Grades &amp; Boutique</span><h2>Privilèges, confort et prestige</h2>
  <p>Accès prioritaire en file d'attente, vol au lobby, gemmes quotidiennes et cosmétiques exclusifs. Zéro avantage abusif en combat : nous préservons l'équité pour tous.</p></div>
  <div class="grille-grades">${GRADES.map((g) => `<a class="grade-carte g-${g.id}" href="/boutique"><img src="${image(`boutique/grade-${g.id}`, `/img/jeu/grade-${g.id}.png`)}" alt="Grade ${esc(g.nom)}" width="104" height="104" loading="lazy"><b>${esc(g.nom)}</b><span>${esc(g.resume)}</span><span class="prix-mini">${g.prixEuros ? `${g.prixEuros.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} · ` : ''}${nombre(g.prix)} gemmes</span></a>`).join('')}</div>
  <div class="actions actions-centre"><a class="btn btn-grand" href="/boutique">Explorer la boutique</a></div>
</div></section>

<section class="section section-blanche"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Classements</span><h2>Les champions d'OrbisMC</h2></div>
  <div class="grille-3">
    <div class="panneau"><div class="panneau-tete"><h3>Arène ELO</h3><span class="pastille">Tower Defense</span></div>${tableau(topElo)}</div>
    <div class="panneau"><div class="panneau-tete"><h3>Record de vague</h3><span class="pastille">Tower Defense</span></div>${tableau(topVague, (v) => `vague ${nombre(v)}`)}</div>
    <div class="panneau"><div class="panneau-tete"><h3>Quotas tenus</h3><span class="pastille">Lethal Craft</span></div>${tableau(topQuotas)}</div>
  </div>
  <div class="actions actions-centre"><a class="btn btn-contour" href="/classements">Voir tous les classements</a></div>
</div></section>

<section class="section"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Rejoindre en 30 secondes</span><h2>Comment commencer à jouer ?</h2><p>Rejoins-nous en 3 étapes simples sans téléchargement superflu.</p></div>
  <div class="etapes">
    <div class="panneau etape"><span class="num">1</span><h3>Lance Minecraft Java</h3><p>Ouvre ton launcher Minecraft Java en version <b>${esc(config.versionJeu)}</b>. Comptes officiels et alternatifs acceptés.</p></div>
    <div class="panneau etape"><span class="num">2</span><h3>Ajoute l'adresse IP</h3><p>Dans <b>Multijoueur</b> &gt; <b>Nouveau serveur</b>, saisis l'adresse <b>${esc(config.adresseJeu)}</b> et valide.</p></div>
        <div class="panneau etape"><span class="num">3</span><h3>Choisis ton mode</h3><p>Accepte le pack de ressources à ta connexion, laisse le téléchargement se terminer, puis rejoins un mode depuis le lobby.</p></div>
  </div>
</div></section>

<section class="section section-blanche" id="faq"><div class="enveloppe grille-2">
  <div>
    <span class="etiquette-section">Foire Aux Questions</span><h2>Questions fréquentes</h2>
    <p>Tout ce que tu dois savoir avant de te lancer sur ${esc(NOM)}. Une autre question ? L'équipe est disponible en jeu${DISCORD ? ' et sur Discord' : ''}.</p>
    ${equipe.length ? `<div class="equipe">${equipe.map((m) => `<a class="membre" href="/joueur/${encodeURIComponent(m.pseudo)}">${tete(m.pseudo)}<span><b>${esc(m.pseudo)}</b><span class="pastille ${esc(m.grade)}">${esc(NOMS_GRADES[m.grade])}</span></span></a>`).join('')}</div>` : ''}
  </div>
  <div class="faq">
    ${FAQ_ACCUEIL.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}
  </div>
</div></section>

<section class="section"><div class="enveloppe"><div class="appel">
  <img class="logo" src="${LOGO()}" alt="${esc(NOM)}" width="320" height="145">
  <h2>Prêt à relever le défi ?</h2>
  <p>Copie l'IP <b>${esc(config.adresseJeu)}</b>, lance Minecraft Java ${esc(config.versionJeu)} et rejoins l'aventure dès maintenant !</p>
  ${ip('ip-appel')}
</div></div></section>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: NOM, url: seo.url('/'), logo: seo.url('/img/marque/logo.png'), ...(DISCORD ? { sameAs: [DISCORD] } : {}) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: NOM, url: seo.url('/'), inLanguage: 'fr-FR' },
    {
      '@context': 'https://schema.org', '@type': 'VideoGame', name: NOM, url: seo.url('/'), inLanguage: 'fr',
      description: `Serveur Minecraft Java ${config.versionJeu} français avec quatre jeux originaux : ${Object.values(JEUX).map((j) => j.nom).join(', ')}.`,
      gamePlatform: 'Minecraft Java Edition', genre: ['Tower Defense', 'Survie', 'Donjon', 'Multijoueur'], playMode: 'MultiPlayer',
      isAccessibleForFree:true,
    },
    seo.faqLd(FAQ_ACCUEIL),
  ];
  return page({ corps, actif: 'accueil', jsonld }, res);
}

// ------------------------------------------------------------------ guide de première connexion
function rejoindre(res) {
  const questions=[
    ['Quelle adresse utiliser pour rejoindre OrbisMC ?',`L’adresse est ${config.adresseJeu}. Ajoute-la dans Multijoueur, puis Nouveau serveur, sur Minecraft Java Edition.`],
    ['Quelles versions de Minecraft sont acceptées ?',`Minecraft Java ${config.versionJeu}. Minecraft Bedrock sur console ou mobile n’est pas pris en charge par ce guide.`],
    ['Faut-il installer un mod ou un launcher spécial ?','Aucun mod n’est requis. Le pack de ressources est proposé par le serveur ; accepte-le et attends la fin de son téléchargement.'],
    ['Comment créer mon compte et relier mon mail ?','Commence par te connecter en jeu. Le compte officiel est reconnu ; les autres joueurs suivent l’inscription du lobby. Tape ensuite /site pour obtenir un code temporaire, puis relie ton mail depuis la page d’inscription web.'],
    ['Quel mode essayer en premier ?','Tower Defense pour construire à ton rythme, Lethal Craft pour explorer des lunes en escouade, Donjon pour jouer une classe en coopération, ou 1 vs 1 pour une course d’objectifs de survie sans PvP.'],
  ];
  const corps=`${tetePage('Guide de connexion','Comment rejoindre OrbisMC ?',`Prépare ta première partie sur notre serveur Minecraft Java français, en version ${config.versionJeu}.`)}
<section class="section"><div class="enveloppe">
  ${!config.ouvert?'<div class="avis info" role="status"><div><b>OrbisMC est en préouverture.</b><p>Tu peux préparer ta connexion et découvrir les modes. L’accès au serveur, aux comptes et aux achats sera annoncé à l’ouverture.</p></div></div>':''}
  <div class="tete-section"><span class="etiquette-section">Ton premier voyage</span><h2>Trois étapes pour commencer</h2><p>Un client Minecraft Java, l’adresse du serveur et un mode à explorer.</p></div>
  <ol class="jeu-etapes">
    <li class="panneau"><span class="etape-numero">01</span><h3>Ouvre Minecraft Java</h3><p>Utilise une version compatible : <b>${esc(config.versionJeu)}</b>. Aucun mod n’est nécessaire.</p></li>
    <li class="panneau"><span class="etape-numero">02</span><h3>Ajoute OrbisMC</h3><p>Dans <b>Multijoueur → Nouveau serveur</b>, saisis <b>${esc(config.adresseJeu)}</b>. Accepte le pack de ressources à la connexion.</p></li>
    <li class="panneau"><span class="etape-numero">03</span><h3>Choisis ton aventure</h3><p>Depuis le lobby, utilise <code>/jouer</code>. À l’ouverture, découvre les quatre modes avec <code>/decouverte</code> pour obtenir ton titre d’explorateur.</p></li>
  </ol>
  <div class="actions actions-centre"><a class="btn" href="/#jeux">Découvrir les quatre jeux</a><a class="btn btn-contour" href="/inscription">Créer et relier mon compte</a></div>
</div></section>
<section class="section section-blanche"><div class="enveloppe grille-2"><div><span class="etiquette-section">Besoin d’un coup de main ?</span><h2>Bien démarrer sur le serveur</h2><p>Si le pack ne se charge pas, vérifie que les packs du serveur sont autorisés dans la fiche OrbisMC, puis reconnecte-toi. Si le serveur est en maintenance, attends l’annonce de réouverture.</p><p>Les achats restent cosmétiques. Ton grade et ton inventaire cosmétique sont liés à ton compte Minecraft.</p><div class="actions"><a class="btn btn-contour" href="/wiki">Commandes et règles</a><a class="lien" href="/contact">Contacter le support</a></div></div><div class="faq">${questions.map(([q,r])=>`<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</div></div></section>`;
  return page({titre:'Rejoindre notre serveur Minecraft Java',corps,description:`Comment rejoindre ${NOM} sur Minecraft Java : IP ${config.adresseJeu}, versions compatibles, pack de ressources, compte et découverte des quatre modes.`,jsonld:[seo.fil([['Rejoindre','/rejoindre']]),seo.faqLd(questions)]},res);
}

// ------------------------------------------------------------------ page d'un jeu

function jeu(res, id, { tops, statut }) {
  const j = JEUX[id];
  const liste = captures(id);
  const depart = {
    td: { format: 'Solo · raids entre joueurs', rythme: 'Une base qui évolue à ton rythme', conseil: 'Commence avec un chemin simple et améliore tes premières tours avant de multiplier les achats.', etapes: [['Ton île', 'Rejoins le Tower Defense depuis /jouer et prends tes repères sur ton terrain.'], ['Ta défense', 'Trace ton chemin, place une première tour et observe les premières vagues.'], ['La progression', 'Explore la Carrière pour débloquer des tours, puis découvre les raids et l’arène.']] },
    lethal: { format: '1 à 4 en escouade', rythme: 'Extraction avant minuit', conseil: 'Annonce tes trouvailles à ton équipe et garde assez de temps pour revenir au vaisseau.', etapes: [['Ton équipage', 'Rejoins Lethal Craft et forme une escouade, ou utilise le remplissage automatique.'], ['La préparation', 'Repère le terminal et ton matériel avant de choisir une lune.'], ['L’extraction', 'Explore, rapporte de la ferraille et reviens avant le décollage : mieux vaut rentrer vivant.']] },
    donjon: { format: '1 à 4 en escouade', rythme: '12 niveaux · une descente complète', conseil: 'Teste ta classe dans la Citadelle et choisis une difficulté adaptée avant de partir.', etapes: [['Ta classe', 'Rejoins la Citadelle depuis /jouer et découvre les classes.'], ['Ton escouade', 'Pars seul ou rassemble jusqu’à trois alliés ; prépare ton équipement à la Forge.'], ['La descente', 'Avance salle par salle, surveille les pièges et garde tes ressources pour les gardiens.']] },
    duel: { format: '2 joueurs · sans PvP', rythme: '10 minutes maximum', conseil: 'Lis bien l’objectif : courir après le mauvais objet peut coûter toute la manche.', etapes: [['Ton adversaire', 'Choisis 1 vs 1 depuis /jouer, entre dans la file ou défie un ami.'], ['Le défi', 'Lis l’objectif tiré au sort : c’est une course de survie, pas un combat.'], ['La course', 'Trouve une stratégie, réussis avant ton adversaire et tente de monter dans le classement ELO.']] },
  }[id];
  const corps = `
<section class="jeu-hero ${id}">
  <img class="jeu-decor" src="${image(`site/scene-${id}`, `/img/jeu/mode-${id}.png`)}" alt="" width="1600" height="800" fetchpriority="high">
  <div class="enveloppe bandeau-jeu"><div class="jeu-intro"><a class="jeu-retour" href="/#jeux">${iconeSvg('arrow-left',16)} Les quatre jeux</a><span class="etiquette-section">${esc(j.genre)} · Jeu ${j.num}</span><h1>${esc(j.nom)}</h1><h2>${esc(j.accroche)}</h2><p>${esc(j.resume)}</p>
    <div class="jeu-reperes"><span>${iconeSvg('users',18)}${esc(depart.format)}</span><span>${iconeSvg('clock',18)}${esc(depart.rythme)}</span></div>
    <div class="actions"><a class="btn" href="/rejoindre">${config.ouvert?'Jouer maintenant':'Comment rejoindre'}</a><a class="btn btn-hero" href="#premiere-partie">Le déroulement ${iconeSvg('arrow-down',16)}</a></div></div>
  <span class="jeu-legende">Illustration de l’univers · Java ${esc(config.versionJeu)}</span>
</div></section>

<section class="section section-blanche ${id}" id="premiere-partie"><div class="enveloppe"><div class="tete-section"><span class="etiquette-section">Ta première partie</span><h2>Entre dans l’aventure</h2><p>${esc(j.texte)}</p></div><ol class="jeu-etapes">${depart.etapes.map(([titre,texte],n)=>`<li class="panneau"><span class="etape-numero">0${n+1}</span><h3>${esc(titre)}</h3><p>${esc(texte)}</p></li>`).join('')}</ol><div class="jeu-conseil">${iconeSvg('compass',24)}<p><b>Le conseil de départ</b><br>${esc(depart.conseil)}</p></div></div></section>

<section class="section ${id}"><div class="enveloppe">
  <div class="tete-section"><span class="etiquette-section">Au programme</span><h2>Ce qui t'attend</h2></div>
  <div class="grille-3">${j.fonctions.map(([ic, t, d]) => `<div class="panneau fonction"><div class="icone-box">${iconeSvg(ic, 24)}</div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
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
  <h2>Envie d'essayer ?</h2><p>${config.ouvert ? `${enLigne(statut)}. Rejoins le serveur et choisis ${esc(j.nom)} au lobby.` : `Rejoins le Discord officiel pour être parmi les premiers testeurs lors de l'ouverture de ${esc(j.nom)} !`}</p>${ip('ip-appel')}
</div></div></section>`;
  const metadata={
    td:['Tower Defense Minecraft : construis ta défense',`Bâtis ta base sur ${NOM} : 9 tours, vagues de monstres, Carrière et raids. Découvre notre Tower Defense Minecraft Java, gratuit et sans mod.`],
    lethal:['Lethal Craft Minecraft : exploration en coop',`Explore des lunes hostiles à 1–4 joueurs sur ${NOM}. Rapporte la ferraille avant minuit dans Lethal Craft, notre mode Minecraft Java sans mod.`],
    donjon:['Donjon Minecraft : aventure coop et Roi-Liche',`Explore 12 niveaux à 1–4 joueurs sur ${NOM}. Choisis parmi 5 classes, améliore ton équipement à la Forge et affronte le Roi-Liche. Sans mod.`],
    duel:['1 vs 1 Minecraft : défis de survie sans PvP',`Deux joueurs, un objectif et dix minutes : gagne la course sur ${NOM}. Découvre les défis de survie Minecraft Java, sans PvP, avec classement ELO.`],
  }[id];
  return page({ titre:metadata[0], actif:'jeux', corps, description:metadata[1],image:`/img/site/scene-${id}.webp`,largeurImage:1600,hauteurImage:800,altImage:`Illustration de ${j.nom} sur ${NOM}`,jsonld:[seo.fil([['Jeux','/#jeux'],[j.nom,`/jeux/${id}`]]),{'@context':'https://schema.org','@type':'VideoGame',name:j.nom,description:metadata[1],url:seo.url(`/jeux/${id}`),image:seo.url(`/img/site/scene-${id}.webp`),inLanguage:'fr-FR',gamePlatform:'Minecraft Java Edition',genre:j.genre,isAccessibleForFree:true,isPartOf:{'@type':'WebSite',name:NOM,url:seo.url('/')}}]},res);
}

// ------------------------------------------------------------------ classements

const ONGLETS = {
  td: { nom: 'Tower Defense', cle: 'td_elo', sous: 'Arène ELO', format: (v) => `${nombre(v)} ELO` },
  vague: { nom: 'Record de vague', cle: 'td_record', sous: 'Tower Defense', format: (v) => `vague ${nombre(v)}` },
  raids: { nom: 'Raids gagnés', cle: 'td_raids_gagnes', sous: 'Tower Defense', format: (v) => nombre(v) },
  lethal: { nom: 'Lethal Craft', cle: 'lethal_quotas', sous: 'Quotas tenus', format: (v) => `${nombre(v)} quotas` },
  ferraille: { nom: 'Ferraille', cle: 'lethal_ferraille', sous: 'Lethal Craft', format: (v) => `${nombre(v)} ₵` },
  donjon: { nom: 'Donjon', cle: 'donjon_victoires', sous: 'Rois-Liches vaincus', format: (v) => `${nombre(v)} victoire${v > 1 ? 's' : ''}` },
  // Score de vitesse = 21600 − durée de la descente en secondes (le tri est décroissant), retraduit ici en chrono.
  vitesse: { nom: 'Descente rapide', cle: 'donjon_vitesse', sous: 'Donjon, du départ au Roi-Liche', format: (v) => duree((21600 - Number(v)) * 1000) },
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
    + groupe('lethal', 'Lethal Craft', [['lethal_quotas', 'Meilleure série de quotas'], ['lethal_ferraille', 'Ferraille rapportée'], ['lethal_jours', 'Journées survécues']])
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
  return page({ titre: `${p.pseudo} : profil joueur`, corps, description: `Profil de ${p.pseudo} sur ${NOM} : statistiques Tower Defense, Lethal Craft, Donjon et 1 vs 1.`, jsonld: [{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: p.pseudo, url: seo.url(`/joueur/${p.pseudo}`) } }] }, res);
}

function introuvable(res, message = "Cette page n'existe pas.") {
  const corps = tetePage('Erreur', 'Perdu dans le vide', message, '', '<div class="actions"><a class="btn" href="/">Retour à l\'accueil</a></div>') + '<section class="page"></section>';
  return page({ titre: 'Introuvable', corps, indexer: false }, res);
}

// ------------------------------------------------------------------ connexion et compte

function connexion(res, { erreur = '', code = '', pseudo = '', disponible = true } = {}) {
  const csrf = esc(res.locals.csrf);
  const corps = `
${tetePage('Mon compte', 'Content de te revoir', 'Ton aventure, tes cosmétiques, un seul compte.')}
<section class="page"><div class="enveloppe">
  <div class="compte-accueil"><p>Tu nous rejoins pour la première fois ?</p><a class="btn btn-contour" href="/inscription">Créer mon compte</a></div>
  ${!disponible ? '<div class="avis info" role="status"><div><b>Les comptes ne sont pas encore accessibles en ligne.</b><p>Le site est en préouverture. La connexion et les achats seront activés avec le raccordement du serveur. Ton compte existant est conservé ; tu n’as pas besoin de le recréer.</p><a class="lien" href="/inscription">Comment créer et relier mon compte ?</a></div></div>' : ''}
  ${avis(erreur, 'erreur')}
  <div class="connexion">
    <div class="panneau panneau-corps">
      <span class="etiquette-section">Avec un mot de passe</span><h2>Mail ou pseudo</h2>
      <p>Utilise ton adresse vérifiée et ton mot de passe web, ou ton pseudo et ton mot de passe Minecraft.</p>
      <form class="formulaire" method="post" action="/connexion" autocomplete="on"><fieldset ${disponible?'':'disabled'}>
        <input type="hidden" name="_csrf" value="${csrf}">
        <label>Adresse mail ou pseudo<input name="pseudo" required maxlength="254" value="${esc(pseudo)}" autocomplete="username" spellcheck="false"></label>
        <label>Mot de passe<input name="mdp" type="password" required maxlength="64" autocomplete="current-password"></label>
        <button class="btn btn-plein" type="submit">Se connecter</button>
      </fieldset>
      </form>
      <a class="lien" href="/connexion/recuperer">Mot de passe web oublié ?</a>
    </div>
    <div class="panneau panneau-corps">
      <span class="etiquette-section">Avec un code</span><h2>Code de connexion</h2>
      <p>Pas envie de taper ton mot de passe ? Tape <code>/site</code> en jeu pour te connecter instantanément avec un code temporaire.</p>
      <form class="formulaire" method="post" action="/connexion/code"><fieldset ${disponible?'':'disabled'}>
        <input type="hidden" name="_csrf" value="${csrf}">
        <label>Code<input name="code" required maxlength="8" value="${esc(code)}" autocomplete="one-time-code" spellcheck="false"></label>
        <button class="btn btn-violet btn-plein" type="submit">Valider le code</button>
      </fieldset>
      </form>
    </div>
  </div>
</div></section>`;
  return page({ titre: 'Connexion', actif: 'compte', corps, indexer: false }, res);
}

function inscription(res,{erreur='',message='',disponible=true,mailDisponible=true}={}) {
 const csrf=esc(res.locals.csrf);
 const etapes=[['Rejoins OrbisMC',`Ajoute ${config.adresseJeu} dans Minecraft Java. Ton compte officiel est reconnu ; sinon, suis le formulaire du lobby ou /register <mot de passe> <confirmation>.`],['Prouve que c’est ton compte','Une fois connecté en jeu, tape /site et récupère un code neuf. Aucun autre joueur ne peut réserver ton pseudo sur le site.'],['Relie ton mail','Saisis le code, ton adresse et un mot de passe réservé au site. Confirme le mail reçu pour activer ta connexion web.']];
 const corps=`${tetePage('Bienvenue sur OrbisMC','Ton aventure commence ici','Un compte Minecraft relié, une adresse vérifiée, tes achats au bon endroit.')}<section class="page"><div class="enveloppe">
 <div class="compte-accueil"><p>Tu as déjà un compte ?</p><a class="btn btn-contour" href="/connexion">Me connecter</a></div>
 <ol class="inscription-etapes">${etapes.map(([titre,texte],i)=>`<li><span class="etape-numero">0${i+1}</span><h2>${esc(titre)}</h2><p>${esc(texte)}</p></li>`).join('')}</ol>
 ${!disponible?'<div class="avis info" role="status"><div><b>Les inscriptions web ouvriront avec le serveur.</b><p>Le site est en préouverture : la base des comptes n’est pas encore raccordée. Tu peux déjà découvrir les jeux et la boutique.</p></div></div>':!mailDisponible?'<div class="avis info" role="status">La liaison par mail ouvrira après l’activation de la messagerie. Si ton compte Minecraft existe déjà, connecte-toi avec /site.</div>':''}
 ${avis(erreur,'erreur')}${avis(message,'succes')}
 ${!message?`<div class="panneau panneau-corps inscription-form"><span class="etiquette-section">Créer mon accès web</span><h2>Relie ton compte Minecraft</h2><p>Le mot de passe web est indépendant de celui utilisé en jeu.</p><form class="formulaire" method="post" action="/inscription"><fieldset ${disponible&&mailDisponible?'':'disabled'}><input type="hidden" name="_csrf" value="${csrf}"><label>Code neuf obtenu avec /site<input name="code" required minlength="8" maxlength="8" autocomplete="one-time-code" spellcheck="false"></label><label>Adresse mail<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>Mot de passe web<input name="mdp" type="password" required minlength="12" maxlength="64" autocomplete="new-password"><span class="petit">12 à 64 caractères.</span></label><button class="btn btn-plein" type="submit">Créer mon accès et vérifier mon mail</button></fieldset></form></div>`:'<p><a class="btn" href="/compte">Accéder à mon compte</a></p>'}
 </div></section>`;
 return page({titre:'Inscription',actif:'compte',corps,indexer:false},res);
}

function identiteMail(res, { mode, erreur = '', message = '', jeton = '', disponible = true }) {
  const csrf = `<input type="hidden" name="_csrf" value="${esc(res.locals.csrf)}">`;
  const secret = '<label>Mot de passe web (12 à 64 caractères)<input type="password" name="mdp" required minlength="12" maxlength="64" autocomplete="new-password"></label>';
  const token = `<input type="hidden" name="jeton" value="${esc(jeton)}">`;
  let formulaire = '';
  if (mode === 'lier' && disponible && !message) formulaire = `<p>Tape <code>/site</code> en jeu pour prouver que ce compte Minecraft est bien le tien. Choisis ensuite un mot de passe réservé au site. La liaison prend effet uniquement après confirmation du mail.</p><form class="formulaire" method="post" action="/compte/mail">${csrf}<label>Code neuf obtenu avec /site<input name="code" required maxlength="8" autocomplete="one-time-code"></label><label>Adresse mail<input type="email" name="email" required maxlength="254" autocomplete="email"></label>${secret}<button class="btn" type="submit">Envoyer le lien de vérification</button></form>`;
  if (mode === 'lier' && !disponible) formulaire = '<p>Le service de vérification par mail sera activé avec la configuration de la messagerie.</p>';
  if (mode === 'confirmer') formulaire = `<p>Confirme la liaison de ton adresse à ton compte Minecraft actuellement connecté.</p><form method="post" action="/compte/mail/confirmer">${csrf}${token}<button class="btn" type="submit">Confirmer mon adresse</button></form>`;
  if (mode === 'recuperer') formulaire = `<p>Le lien permettra de changer uniquement ton mot de passe web. Tu peux toujours te reconnecter avec <code>/site</code> en jeu.</p><form class="formulaire" method="post" action="/connexion/recuperer">${csrf}<label>Adresse vérifiée<input name="email" type="email" required maxlength="254" autocomplete="email"></label><button class="btn" type="submit">Recevoir un lien de récupération</button></form>`;
  if (mode === 'reinitialiser') formulaire = `<form class="formulaire" method="post" action="/connexion/reinitialiser">${csrf}${token}${secret}<button class="btn" type="submit">Changer mon mot de passe web</button></form>`;
  const corps = `${tetePage('Mon compte', 'Sécurité et adresse mail', 'Un compte Minecraft, une adresse vérifiée, tes achats au bon endroit.')}<section class="page"><div class="enveloppe"><div class="panneau panneau-corps">${avis(erreur, 'erreur')}${avis(message, 'succes')}${formulaire}<p><a class="lien" href="/connexion">Connexion</a> · <a class="lien" href="/compte">Mon compte</a></p></div></div></section>`;
  return page({ titre: 'Sécurité du compte', actif: 'compte', corps, indexer: false }, res);
}

function compte(res, { p, catalogue, identite = null, mailDisponible = false, message: codeOk, erreur: codeErreur, cat: catDemandee }) {
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
      ${dansCat.length ? `<div class="minis">${dansCat.map((c) => `<div class="mini ${equipes.has(c.id) ? 'equipe' : ''}"><div class="mini-apercu r-${rarete(c).cls}">${visuelCosmetique(c, p.pseudo)}</div><div class="mini-infos"><b>${esc(c.nom)}</b>${String(c.categorie).startsWith('UC_') ? '<span class="actuel">Menu cosmétiques en jeu</span>' : equipes.has(c.id) ? '<span class="actuel">Équipé</span>' : `<form method="post" action="/compte/equiper"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="id" value="${esc(c.id)}"><input type="hidden" name="cat" value="${cat}"><button class="lien-bouton" type="submit">Équiper</button></form>`}</div></div>`).join('')}</div>`
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
  <div class="panneau panneau-corps marge-haut"><h2>Sécurité du compte</h2>${identite ? `<p>Adresse vérifiée : <b>${esc(identite.email)}</b>. Tes achats sont livrés au compte Minecraft ${esc(p.pseudo)}.</p><a class="lien" href="/connexion/recuperer">Changer le mot de passe web</a>` : `<p>Relie ton adresse mail à ce compte Minecraft pour te connecter avec un mot de passe web et récupérer ton accès.</p>${mailDisponible ? '<a class="btn btn-petit" href="/compte/mail">Relier mon adresse</a>' : '<p class="discret">Vérification par mail disponible après la configuration du service de messagerie.</p>'}`}</div>
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
  chapeaux: { cle: 'UC_CHAPEAU', nom: 'Chapeaux', icone: 'cat-chapeaux', aide: 'Des têtes dessinées sur ta tête, au lobby. Équipe-les avec le menu cosmétiques (case 1 du lobby).' },
  particules: { cle: 'UC_PARTICULE', nom: 'Particules', icone: 'cat-trainees', aide: 'Des effets autour de toi, dans tous les modes.' },
  familiers: { cle: 'UC_FAMILIER', nom: 'Familiers', icone: 'cat-compagnons', aide: 'Un animal qui te suit au lobby.' },
  gadgets: { cle: 'UC_GADGET', nom: 'Gadgets', icone: 'cat-gadgets', aide: 'Des jouets à utiliser au lobby. Les icônes représentent leurs objets ; teste leurs effets en jeu.' },
  montures: { cle: 'UC_MONTURE', nom: 'Montures', icone: 'cat-montures', aide: 'Des montures à chevaucher au lobby. Les portraits représentent leur espèce ; les effets spéciaux sont à découvrir en jeu.' },
  costumes: { cle: 'UC_COSTUME', nom: 'Costumes', icone: 'cat-costumes', aide: 'Un costume complet, au lobby. Mannequins avec les matériaux et couleurs du costume ; effets purement cosmétiques.' },
  emotes: { cle: 'UC_EMOTE', nom: 'Émotes', icone: 'cat-emotes', aide: 'Des visages animés, au lobby.' },
  projectiles: { cle: 'UC_PROJECTILE', nom: 'Projectiles', icone: 'cat-projectiles', aide: 'Une traînée derrière tes flèches, dans tous les modes.' },
  morts: { cle: 'UC_MORT', nom: 'Effets de mort', icone: 'cat-morts', aide: 'Un effet quand tu tombes, dans tous les modes.' },
  fetes: { cle: 'FETE', nom: 'Packs', icone: 'cat-packs', aide: 'Des collections thématiques à prix réduit et des cosmétiques de saison exclusifs. Déplie chaque lot pour voir son contenu.' },
};
function categorieValide(c) {
  return Object.hasOwn(CATS, String(c || '')) ? String(c) : 'titres';
}

const EXPLICATIONS_TITRES = {
  titre_eclaireur: 'Parcours /decouverte : visiter les quatre modes (gratuit)',
  titre_briseur_givre: 'Vaincre le Roi-Liche pendant l’assaut coopératif /warp',
  titre_emissaire: "Quête de l'Émissaire des Mondes au Lobby (4 univers)",
  titre_fleau_divin: "Vaincre le Roi-Liche en difficulté Dieu (Donjon)",
  titre_liche: "Forge du Donjon (4 000 Âmes)",
  titre_donjon100: "Atteindre le niveau 100 du Donjon",
  titre_extraction100: "Atteindre le niveau 100 de Lethal Craft",
  titre_arene: "Tenir 40 vagues dans l'Arène du Donjon",
  titre_survivant: "Tenir 20 vagues dans l'Arène du Donjon (ou 500 gemmes)",
  titre_kamikaze: "Trophée : Exploser au combat en Duel",
  titre_favori: "Remporter 30 Duels 1v1",
  titre_employe: "Atteindre 10 quotas dans le mode Lethal Craft",
  titre_veteran: "Survivre à 50 jours dans le mode Lethal Craft",
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
  if (Number(c.prix) === 0) {
    if (c.id === 'titre_eclaireur') return { cls: 'exclusif', nom: 'Découverte' };
    if (c.id === 'titre_briseur_givre') return { cls: 'exclusif', nom: 'Assaut coop' };
    if (String(c.id).startsWith('titre_prestige_')) return { cls: 'epique', nom: 'Prestige 50' };
    if (c.id === 'titre_emissaire') return { cls: 'legendaire', nom: 'Quête Ultime' };
    if (c.id === 'titre_fleau_divin') return { cls: 'legendaire', nom: 'Défi Dieu' };
    if (c.id.includes('grade') || c.id === 'titre_vip' || c.id === 'titre_elite' || c.id === 'titre_habitue' || c.id === 'couleur_elite' || c.id === 'couleur_legende') return { cls: 'exclusif', nom: 'Exclusif Grade' };
    return { cls: 'exclusif', nom: 'Quête en jeu' };
  }
  if (c.monnaie === 'PIECES') return { cls: 'td', nom: 'Tower Defense' };
  if (c.monnaie === 'AMES') return { cls: 'donjon', nom: 'Donjon' };
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
  if (c.categorie === 'UC_CHAPEAU' && Object.hasOwn(CHAPEAUX, c.valeur)) return `<img class="cosm-image cosm-tete" src="${CHAPEAUX[c.valeur]}" alt="Tête 3D : ${esc(c.nom)}" width="256" height="256" loading="lazy" decoding="async">`;
  const rendu = Object.hasOwn(VISUELS_COSMETIQUES,c.valeur) ? VISUELS_COSMETIQUES[c.valeur] : null;
  if (rendu) return `<figure class="rendu-cosm"><img class="cosm-image cosm-modele" src="${rendu.image}?v=${version(rendu.image.slice(1))}" alt="${esc(c.nom)}" width="320" height="320" loading="lazy" decoding="async"><figcaption>${esc({modele:'Aperçu 3D',portrait:'Portrait de l’espèce',objet:'Icône Minecraft',illustration:'Illustration'}[rendu.type])}</figcaption></figure>`;
  if (c.categorie === 'FETE') {
    const apercus = packs.valeurs(c).map(v => CHAPEAUX[v] || VISUELS_COSMETIQUES[v]?.image).filter(Boolean);
    const symbole = /inlove/.test(c.valeur) ? '♥' : /easterbunny/.test(c.valeur) ? '❀' : '';
    return `<div class="pack-apercu pack-galerie"><img class="cosm-image" src="/img/boutique/onglet-cosmetiques.webp" alt="Coffre de cosmétiques" width="192" height="192" loading="lazy"><div class="pack-objets">${[...new Set(apercus)].slice(0,3).map(src => `<img src="${src}" alt="Cosmétique inclus" width="256" height="256" loading="lazy">`).join('')}${symbole ? `<span class="pack-symbole ${symbole==='♥'?'pack-amour':'pack-printemps'}" aria-label="Illustration du thème">${symbole}</span>` : ''}</div></div>`;
  }
  if (['UC_PARTICULE','UC_PROJECTILE','UC_MORT'].includes(c.categorie)) {
    const nom = String(c.valeur).toLowerCase();
    const theme = /flame|fire|lava|volcan|inferno/.test(nom) ? 'braise' : /snow|frost|frozen|ice/.test(nom) ? 'givre' : /heart|love|cherry/.test(nom) ? 'rose' : /green|slime|nature/.test(nom) ? 'nature' : 'cosmos';
    const symbole = /heart|love/.test(nom) ? '♥' : /music|note/.test(nom) ? '♪' : theme === 'givre' ? '❄' : '✦';
    return `<figure class="apercu-effet effet-${theme}${c.categorie === 'UC_PROJECTILE' ? ' effet-tir' : c.categorie === 'UC_MORT' ? ' effet-eclat' : ''}" aria-label="Illustration de ${esc(c.nom)}"><div class="effet-centre">${iconeSvg(c.categorie === 'UC_PROJECTILE' ? 'cat-projectiles' : c.categorie === 'UC_MORT' ? 'cat-morts' : 'cat-trainees',44)}</div><div class="effet-orbite">${Array.from({length:8},(_,i)=>`<i class="ef-${i}">${symbole}</i>`).join('')}</div><figcaption>Illustration de l’effet · teste en jeu</figcaption></figure>`;
  }
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
  const categorie = Object.values(CATS).find(o => o.cle === c.categorie);
  return `<span class="cosm-symbole symbole-svg">${iconeSvg(categorie?.icone || 'sparkles', 72)}</span>`;
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
  return `<nav class="onglets-cosm" aria-label="Catégories de cosmétiques">${Object.entries(CATS).map(([k, o]) => `<a href="${base}cat=${k}${ancre}" class="${k === cat ? 'actif' : ''}"${k === cat ? ' aria-current="page"' : ''}>${iconeSvg(o.icone, 26)}<span>${esc(o.nom)}</span><em>${compter(o.cle)}</em></a>`).join('')}</nav>`;
}

const ONGLETS_BOUTIQUE = {
  grades: { nom: 'Grades', icone: () => image('boutique/onglet-grades', '/img/jeu/onglet-grades.png') },
  gemmes: { nom: 'Gemmes', icone: () => image('boutique/onglet-gemmes', '/img/jeu/onglet-gemmes.png') },
  cosmetiques: { nom: 'Cosmétiques', icone: () => image('boutique/onglet-cosmetiques', '/img/jeu/onglet-cosmetiques.png') },
};

function boutique(res, { onglet, cat: catDemandee, offres, catalogue, p, message: codeOk, erreur: codeErreur, id: idAchat, recherche = '', filtre = '', catalogueDisponible = true }) {
  const achete = codeOk === 'achat' ? catalogue.find((c) => c.id === idAchat) : null;
  const message = achete ? `${achete.nom} : ${messageOk('achat').toLowerCase()}` : messageOk(codeOk);
  const erreur = messageErreur(codeErreur);
  const s = res.locals.session;
  const csrf = s ? esc(res.locals.csrf) : '';
  const paiementDisponible = offres.actif && catalogueDisponible;
  let contenu;

  if (onglet === 'gemmes') {
    const gemmesCount = (o) => Number(o.gemmes) || parseInt(String((String(o.name).match(/\d[\d\s]*/) || [''])[0]).replace(/\s/g, ''), 10) || 0;
    const estValide = (o) => {
      const n = (o.name || '').toLowerCase();
      return (n.includes('gemme') || n.includes('gemmes')) && !n.includes('grade');
    };
    const listeGemmes = (offres.offres || [])
      .filter(estValide)
      .sort((a, b) => gemmesCount(a) - gemmesCount(b));

    const offresAffichees = listeGemmes.length > 0 ? listeGemmes : (offres.offres || []).filter(estValide);
    // Le volume du pack ne garantit pas son rapport gemmes/prix. Comparaison dans une même devise.
    const prixOffre = (o) => Number(o.total_price ?? o.base_price ?? 0);
    const devises = new Set(offresAffichees.map((o) => o.currency || 'EUR'));
    const comparables = offresAffichees.filter((o) => gemmesCount(o) > 0 && prixOffre(o) > 0 && Number.isFinite(prixOffre(o)));
    const meilleurRatio = devises.size === 1 && comparables.length > 1
      ? Math.max(...comparables.map((o) => gemmesCount(o) / prixOffre(o))) : 0;
    const ratiosDifferents = comparables.some((o) => gemmesCount(o) / prixOffre(o) < meilleurRatio * (1 - 1e-6));
    contenu = `<div class="grille-offres">${offresAffichees.map((o, k) => {
      const nbG = gemmesCount(o);
      const bonus = (String(o.name).match(/\+\s*([\d\s]+)\s*bonus/i) || [])[1];
      let sousTitre = o.sous || (nbG === 10000 ? 'Idéal Grade VIP' : nbG === 20000 ? 'Idéal Grade Élite' : nbG === 40000 ? 'Idéal Grade Légende' : nbG >= 70000 ? 'Pack Ultime' : (nbG <= 1000 ? 'Pack Découverte' : nbG <= 3000 ? 'Pack Aventure' : 'Pack de Gemmes'));
      if (/supr[eê]me|100\s*€/i.test(sousTitre)) sousTitre = 'Pack Ultime';
      // Une offre retirée ou réordonnée par Tebex ne doit pas changer le visuel des autres packs.
      const palier = nbG <= 1000 ? 1 : nbG <= 3000 ? 2 : nbG <= 10000 ? 3 : nbG <= 20000 ? 4 : nbG <= 40000 ? 5 : 6;
      const visuel = image(`boutique/gemmes-${palier}`, nbG >= 18000 ? '/img/jeu/gemmes-coffre.png' : nbG >= 8000 ? '/img/jeu/gemmes-bourse.png' : '/img/jeu/gemmes-tas.png');
      const prix = Number(o.total_price ?? o.base_price ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: o.currency || 'EUR' });
      const meilleur = meilleurRatio > 0 && ratiosDifferents && prixOffre(o) > 0
        && Math.abs(nbG / prixOffre(o) - meilleurRatio) <= meilleurRatio * 1e-6;
      const tag = meilleur ? '<span class="etiquette">Meilleur ratio</span>' : '';
      return `<article class="offre offre-gemmes pack-${palier}">${tag}
        <div class="offre-entete">
          <div class="offre-titre">${nombre(nbG)} <span>gemmes</span></div>
          <div class="offre-sous-titre">${esc(sousTitre || '') || '&nbsp;'}</div>
        </div>
        <div class="offre-visuel"><img src="${visuel}" alt="${esc(sousTitre)} : ${nombre(nbG)} gemmes" width="200" height="200" loading="lazy" decoding="async"></div>
        <p class="offre-usage">Titres, couleurs et cosmétiques à choisir en jeu</p>
        ${bonus ? `<div class="offre-bonus">+ ${esc(bonus.trim())} bonus</div>` : ''}
        <div class="offre-pied"><span class="prix">${esc(prix)}</span>
          ${!paiementDisponible ? '<button class="btn btn-petit" disabled>Bientôt</button>' : s ? `<form method="post" action="/boutique/payer"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="offre" value="${esc(o.id)}"><button class="btn btn-petit" type="submit">Acheter</button></form>`
            : '<a class="btn btn-petit" href="/connexion">Acheter</a>'}</div>
      </article>`;
    }).join('')}</div>`;
  } else if (onglet === 'cosmetiques') {
    const cat = categorieValide(catDemandee);
    const normaliser = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const terme = normaliser(recherche.trim());
    const filtreActif = ['jeu', 'abordable', 'possedes'].includes(filtre) ? filtre : '';
    const visibles = (cle) => catalogue.filter((c) => {
      if (c.categorie !== cle) return false;
      if (terme && !normaliser(c.nom).includes(terme)) return false;
      if (filtreActif === 'jeu' && !(Number(c.prix) === 0 || (c.monnaie && c.monnaie !== 'GEMMES'))) return false;
      if (filtreActif === 'possedes' && !(p && p.possedes.has(c.id))) return false;
      if (filtreActif === 'abordable' && !(p && c.prix > 0 && (!c.monnaie || c.monnaie === 'GEMMES') && c.prix <= p.gemmes && !p.possedes.has(c.id))) return false;
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
    const queryFiltres = `${recherche ? `q=${encodeURIComponent(recherche)}&` : ''}${filtreActif ? `filtre=${filtreActif}&` : ''}`;
    contenu = `<form class="filtres-boutique" method="get" action="/boutique/cosmetiques"><input type="hidden" name="cat" value="${cat}">
      <label>Rechercher un cosmétique<input class="champ" name="q" type="search" maxlength="80" value="${esc(recherche)}" placeholder="Nom du cosmétique"></label>
      <label>Afficher<select class="champ" name="filtre"><option value="">Tous les articles</option>${[['jeu', 'À gagner en jeu'], ...(p ? [['abordable', 'Avec mon solde'], ['possedes', 'Mes articles']] : [])].map(([v, nom]) => `<option value="${v}"${filtreActif === v ? ' selected' : ''}>${nom}</option>`).join('')}</select></label>
      <button class="btn btn-petit" type="submit">Filtrer</button><a href="/boutique/cosmetiques?cat=${cat}">Réinitialiser</a></form>
    ${ongletsCosmetiques(`/boutique/cosmetiques?${queryFiltres}`, cat, (cle) => visibles(cle).length)}
    <div class="tete-vitrine"><div><h2>${esc(CATS[cat].nom)}</h2><p>${esc(CATS[cat].aide)}</p></div>${p ? `<span class="pastille">${possedesCat} / ${articles.length} à toi</span>` : ''}</div>
    ${articles.length ? '' : '<p class="avis info" role="status">Aucun cosmétique ne correspond à ces filtres.</p>'}
    <div class="vitrine">${articles.map((c) => {
      const possede = p && p.possedes.has(c.id);
      const r = rarete(c);
      const enJeu = c.monnaie && c.monnaie !== 'GEMMES';
      const expl = explicationDeblocage(c.id);
      const lot = c.categorie === 'FETE';
      const economie = lot ? packs.economie(c, catalogue) : null;
      const contenuLot = lot ? packs.contenu(c,catalogue) : [];
      const dejaDansLot = p ? contenuLot.filter(a => a.id && p.possedes.has(a.id)).length : 0;
      const detailPack = lot ? `<details class="pack-contenu"><summary>${packs.valeurs(c).length} cosmétiques inclus${economie && !dejaDansLot ? ` · −${economie.pourcent} %` : ''}</summary><ul>${contenuLot.map(a => { const src = CHAPEAUX[a.valeur] || VISUELS_COSMETIQUES[a.valeur]?.image; return `<li>${src ? `<img class="pack-miniature" src="${src}?v=${version(src.slice(1))}" alt="" width="34" height="40" loading="lazy">` : iconeSvg('sparkles',22)}<span>${esc(a.nom)}${p && a.id && p.possedes.has(a.id) ? ' · déjà possédé' : ''}</span></li>`; }).join('')}</ul>${dejaDansLot ? '<p>Tu possèdes déjà une partie du contenu. Le prix du lot reste entier : compare les articles manquants à l’unité.</p>' : economie ? `<p>${nombre(economie.remise)} gemmes économisées sur ${nombre(economie.total)} à l’unité.</p>` : '<p>Collection exclusive au pack.</p>'}</details>` : '';
      let action;
      if (String(c.valeur || '').startsWith('bientot:')) action = '<span class="actuel">Bientôt</span>';
      else if (possede) action = '<span class="actuel">Possédé</span>';
      else if (enJeu) action = `<span class="petit discret" title="${esc(expl)}">${esc(expl || 'À gagner en jeu')}</span>`;
      else if (Number(c.prix) === 0) action = `<span class="petit discret" title="${esc(expl)}">${esc(expl || 'À débloquer')}</span>`;
      else if (!s) action = '<a class="btn btn-contour btn-petit" href="/connexion">Connexion</a>';
      else action = `<form method="post" action="/boutique/cosmetique"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="id" value="${esc(c.id)}"><input type="hidden" name="cat" value="${cat}"><button class="btn btn-petit" type="submit" ${p && p.gemmes >= c.prix ? '' : 'disabled title="Pas assez de gemmes"'}>Acheter</button></form>`;
      return `<article class="cosm r-${r.cls} ${possede ? 'possede' : ''}">
        <div class="cosm-scene">${visuelCosmetique(c, p && p.pseudo)}<span class="rarete">${esc(r.nom)}</span></div>
        <div class="cosm-corps"><b>${esc(c.nom)}</b>${detailPack}<div class="cosm-pied"><span class="cosm-prix">${Number(c.prix) === 0 ? 'En jeu' : prixCosmetique(c)}</span>${action}</div></div>
      </article>`;
    }).join('')}</div>`;
  } else {
    const offreGrade = (idGrade) => {
      if (!offres.offres) return null;
      return offres.offres.find((o) => {
        const n = (o.name || '').toLowerCase();
        if (idGrade === 'vip') return n.includes('vip') && !n.includes('gemmes');
        if (idGrade === 'elite') return (n.includes('élite') || n.includes('elite')) && !n.includes('gemmes');
        if (idGrade === 'legende') return (n.includes('légende') || n.includes('legende')) && !n.includes('gemmes');
        return false;
      });
    };

    contenu = `<div class="grille-offres">${GRADES.map((g) => {
      const dejaInclus = p && GRADES.findIndex((grade) => grade.id === p.grade) > GRADES.findIndex((grade) => grade.id === g.id);
      const offr = offreGrade(g.id);
      const idOffre = offr ? offr.id : null;
      const prixAfficher = offr && offr.total_price != null
        ? Number(offr.total_price).toLocaleString('fr-FR', { style: 'currency', currency: offr.currency || 'EUR' })
        : (g.prixEuros ? `${g.prixEuros.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : `${nombre(g.prix)} <small>gemmes</small>`);
      const sousPrix = g.prixEuros ? `ou ${nombre(g.prix)} gemmes` : 'À débloquer en jeu';

      return `<div class="offre grade g-${g.id}">
        ${g.tag ? `<span class="etiquette ${g.id === 'vip' ? 'violet' : ''}">${esc(g.tag)}</span>` : ''}
        <div class="offre-titre">Grade <span>${esc(g.nom)}</span></div>
        <div class="offre-visuel"><img src="${image(`boutique/grade-${g.id}`, `/img/jeu/grade-${g.id}.png`)}" alt="Emblème du grade ${esc(g.nom)}" width="200" height="200" loading="lazy" decoding="async"></div>
        <p class="offre-usage">${esc(g.resume)}</p>
        <ul class="avantages">${g.avantages.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        <div class="offre-pied">
          <div>
            <span class="prix">${prixAfficher}</span>
            <span class="discret petit prix-sous">${esc(sousPrix)}</span>
          </div>
          ${dejaInclus ? '<span class="actuel">Déjà inclus</span>' : p && p.grade === g.id
            ? '<span class="actuel">Ton grade</span>'
            : g.prixEuros
              ? (paiementDisponible && idOffre
                  ? (s
                      ? `<form method="post" action="/boutique/payer"><input type="hidden" name="_csrf" value="${csrf}"><input type="hidden" name="offre" value="${esc(idOffre)}"><button class="btn btn-petit" type="submit">Acheter</button></form>`
                      : '<a class="btn btn-petit" href="/connexion">Acheter</a>')
                  : '<button class="btn btn-petit" disabled>Bientôt</button>')
              : '<a class="btn btn-petit btn-contour" href="/wiki#grades" title="Voir les conditions en jeu">En jeu</a>'}
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  const corps = `
${tetePage('Boutique officielle', 'Boutique', "Soutiens le serveur, débloque des privilèges exclusifs et personnalise ton style. Zéro pay-to-win dans les jeux.")}
<section class="page"><div class="enveloppe">
  <nav class="onglets-boutique" aria-label="Catégories de la boutique">${Object.entries(ONGLETS_BOUTIQUE).map(([k, o]) => `<a href="/boutique/${k}" class="${k === onglet ? 'actif' : ''}"${k === onglet ? ' aria-current="page"' : ''}><img src="${o.icone()}" alt="" width="42" height="42">${esc(o.nom)}</a>`).join('')}</nav>
  ${avis(message, 'succes')}${avis(erreur, 'erreur')}
  ${!catalogueDisponible ? '<div class="avis info" role="status">La boutique est en préouverture : découvre les articles et prépare ton style. Les achats ouvriront avec la connexion au serveur.</div>' : ''}
  <div class="boutique">
    <div>
      ${onglet === 'gemmes' && !offres.actif ? '<div class="avis info"><span>Le paiement en ligne ouvre très bientôt. En attendant, les gemmes se gagnent en jouant, en votant et dans les coffres.</span></div>' : ''}
      ${onglet === 'grades' ? '<div class="avis info"><span>Débloque ton grade directement en euros ci-dessous ou en jeu avec tes gemmes (<b>/boutique</b>). Vérifie le montant final dans le panier Tebex avant de confirmer ton achat.</span></div>' : ''}
      ${contenu}
    </div>
    <aside class="cote">
      <div class="panneau">
        <div class="panneau-tete"><h3>${s ? esc(s.pseudo) : 'Connexion'}</h3></div>
        <div class="panneau-corps">
          ${s ? `<span class="etiquette-section">Ton solde</span><div class="solde">${nombre(p ? p.gemmes : 0)} <small>gemmes</small></div>
            ${p && p.grade && p.grade !== 'default' ? `<p class="petit">Grade actuel : <span class="pastille ${esc(p.grade)}">${esc(NOMS_GRADES[p.grade] || p.grade)}</span></p>` : ''}
            <a class="btn btn-contour btn-plein" href="/compte">Mon compte</a>`
          : `<p class="petit">Connecte-toi avec ton mail vérifié ou ton pseudo. Les achats arrivent sur le compte Minecraft relié.</p>
            <a class="btn btn-plein" href="/connexion">Se connecter</a>
            <p class="petit discret form-aide">Compte officiel ? Tape <code>/site</code> en jeu pour un lien direct.</p>`}
        </div>
      </div>
      <div class="panneau panneau-corps garanties">
        <div><span class="garantie-icone">${iconeSvg('shield', 20)}</span>Zéro pay-to-win, équité totale en jeu</div>
        <div><span class="garantie-icone">${iconeSvg('zap', 20)}</span>Livraison automatique après confirmation du paiement</div>
        <div><span class="garantie-icone">${iconeSvg('lock', 20)}</span>Paiement sécurisé par Tebex (partenaire Mojang)</div>
      </div>
    </aside>
  </div>
</div></section>`;
  const categorie=onglet==='cosmetiques'?CATS[categorieValide(catDemandee)]:null;
  return page({ titre:categorie?`${categorie.nom} Minecraft : cosmétiques`:`Boutique · ${ONGLETS_BOUTIQUE[onglet].nom}`, actif:'boutique', corps, rechercheInterne:onglet==='cosmetiques'&&!!(recherche||filtre), description:categorie?`${categorie.nom} sur ${NOM} : ${categorie.aide} Découvre les aperçus et conditions de déblocage. Boutique Minecraft sans avantage de combat.`:`Boutique ${NOM} : ${onglet==='gemmes'?'packs de gemmes':'grades Habitué, VIP, Élite et Légende'}. 100 % cosmétique, aucun pay-to-win.`, jsonld:[seo.fil([['Boutique','/boutique/grades'],[categorie?categorie.nom:ONGLETS_BOUTIQUE[onglet].nom,seo.cheminCanonique(`/boutique/${onglet}`,{cat:catDemandee},Object.keys(CATS))]])] },res);
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
      icone: 'globe',
      description: 'Les commandes de base accessibles à tous les joueurs pour naviguer et gérer leur aventure.',
      commandes: [
        { cmd: '/jouer [mode]', desc: 'Ouvre le menu général des jeux ou rejoint directement un mode (td, lethal, donjon, lobby).', badge: 'Tous', tagClass: 'badge-tous', aliases: '/play' },
        { cmd: '/decouverte', desc: 'Visite les quatre modes, reste 30 secondes dans chacun et débloque gratuitement le titre Éclaireur des Mondes. Progression conservée après reconnexion.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/explorer, /parcours' },
        { cmd: '/warp', desc: 'Rejoins les inscriptions du mini-jeu annoncé. Le Trône de Givre est un assaut coopératif du Roi-Liche, prévu le samedi à 21 h (heure de Paris) ; le Carnage est un Pit PvPvE volontaire. Équipement identique pour tous.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/event, /evenement' },
        { cmd: '/warp quitter', desc: 'Quitte le mini-jeu et retrouve le lobby. Les costumes, gadgets et le vol sont suspendus pendant la partie.', badge: 'Tous', tagClass: 'badge-tous', aliases: '/warp programme' },
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
      icone: 'sparkles',
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
      icone: 'gamepad',
      description: 'Commandes interactives spécifiques à chacun de nos quatre modes originaux.',
      commandes: [
        { cmd: '/td', desc: 'Interface du Tower Defense : arbre des technologies, vote de difficulté et boutique de tourelles.', badge: 'Tower Defense', tagClass: 'badge-mode', aliases: '' },
        { cmd: '/escouade', desc: 'Gestion de ton groupe en mode Lethal Craft : inviter des joueurs, choisir le leader et gérer la navette.', badge: 'Lethal Craft', tagClass: 'badge-mode', aliases: '/squad' },
        { cmd: '/primes', desc: 'Consulte les contrats de prime du jour disponibles en Lethal Craft et en Donjon.', badge: 'Lethal Craft / Donjon', tagClass: 'badge-mode', aliases: '/contrats' },
        { cmd: '/donjon', desc: 'Ouvre le grimoire du Donjon : sélection de classe (Mage, Guerrier, etc.), compétences et Forge.', badge: 'Donjon', tagClass: 'badge-mode', aliases: '' },
        { cmd: '/duel <joueur>', desc: 'Lance un défi en 1 contre 1 à un autre joueur dans l\'arène de ton choix.', badge: '1 vs 1', tagClass: 'badge-mode', aliases: '/fight' },
      ]
    },
    {
      id: 'grades',
      titre: 'Commandes & Privilèges des Grades',
      icone: 'crown',
      description: 'Les commandes et avantages réservés aux joueurs ayant débloqué un statut de prestige.',
      commandes: [
        { cmd: '/quotidien (Habitué)', desc: 'Débloque un Coffre Habitué quotidien gratuit (+2 gemmes par jour, pièces et récompenses).', badge: 'Habitué', tagClass: 'badge-habitue', aliases: 'Accessible en jouant' },
        { cmd: '/fly', desc: 'Permet de voler librement dans les airs au lobby pour admirer l\'architecture.', badge: 'VIP, Élite, Légende', tagClass: 'badge-vip', aliases: 'Lobby uniquement' },
        { cmd: '/skin (sans délai)', desc: 'Supprime totalement le temps d\'attente entre deux changements d\'apparence.', badge: 'VIP, Élite, Légende', tagClass: 'badge-vip', aliases: 'Instantané' },
        { cmd: '/glow', desc: 'Active ou désactive un contour lumineux éclatant autour de ton personnage.', badge: 'Élite & Légende', tagClass: 'badge-elite', aliases: 'Lobby' },
        { cmd: '/hat <bloc>', desc: 'Porte n\'importe quel bloc sur la tête sans avoir à le tenir : /hat melon, /hat diamond_block, /hat cake (Tab complète la liste). Au lobby tu n\'as aucun bloc en inventaire — c\'est justement pour ça que la commande prend un nom. /hat retirer l\'enlève.', badge: 'Élite & Légende', tagClass: 'badge-elite', aliases: 'Lobby' },
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
    <a href="#general">${iconeSvg('globe', 18)} Générales</a>
    <a href="#cosmetiques">${iconeSvg('sparkles', 18)} Cosmétiques</a>
    <a href="#modes">${iconeSvg('gamepad', 18)} Modes de jeu</a>
    <a href="#grades">${iconeSvg('crown', 18)} Grades &amp; VIP</a>
  </div>

  ${sections.map((sec) => `
    <div class="section-wiki" id="${sec.id}">
      <div class="tete-section">
        <span class="etiquette-section">${esc(sec.titre.split(' ')[0])}</span>
        <h2><span class="titre-icone-inline">${iconeSvg(sec.icone, 22)}</span> ${esc(sec.titre)}</h2>
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
            <p>Commandes /glow, /hat &lt;bloc&gt;, /sit au lobby, titre dégradé, familier Panda, +20 gemmes/jour.</p>
          </div>
          <a href="/boutique?cat=grades">Découvrir l'Élite</a>
        </div>
        <div class="banniere-grade-wiki legende">
          <div>
            <h3>Grade Légende</h3>
            <p>Le statut ultime : titre doré animé, /flyspeed, Halo divin, feux d'artifice à l'arrivée et +50 gemmes/jour.</p>
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
<section class="page"><div class="contact-cadre">
  <div class="contact-grille">
    <div class="contact-carte contact-infos">
      <div class="contact-titre-bloc">
        <span class="etiquette-section">Assistance</span>
        <h3>Canaux officiels</h3>
        <p class="contact-desc">Notre équipe communautaire est à ton écoute pour toute question, problème boutique ou partenariat.</p>
      </div>

      <div class="contact-canaux">
        <a href="mailto:contact.orbis.server@gmail.com" class="contact-canal" title="Écrire à l'adresse officielle">
          <div class="canal-icone icone-mail">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>
          <div class="canal-texte">
            <span class="canal-label">Email officiel</span>
            <b class="canal-valeur">contact.orbis.server@gmail.com</b>
          </div>
        </a>

        ${DISCORD ? `
        <a href="${esc(DISCORD)}" target="_blank" rel="noopener" class="contact-canal discord" title="Rejoindre le Discord">
          <div class="canal-icone icone-discord">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </div>
          <div class="canal-texte">
            <span class="canal-label">Discord communautaire</span>
            <b class="canal-valeur">Ouvrir un ticket d'aide</b>
          </div>
        </a>` : ''}

        ${YOUTUBE ? `
        <a href="${esc(YOUTUBE)}" target="_blank" rel="noopener" class="contact-canal youtube" title="S'abonner sur YouTube">
          <div class="canal-icone icone-youtube">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.376.55A3.016 3.016 0 0 0 .502 6.186 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .502 5.814 3.016 3.016 0 0 0 2.122 2.136C4.495 20.5 12 20.5 12 20.5s7.505 0 9.376-.55a3.016 3.016 0 0 0 2.122-2.136A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.502-5.814ZM9.75 15.568V8.432L15.818 12Z"/></svg>
          </div>
          <div class="canal-texte">
            <span class="canal-label">YouTube</span>
            <b class="canal-valeur">@OrbisMinecraft</b>
          </div>
        </a>` : ''}

        ${TIKTOK ? `
        <a href="${esc(TIKTOK)}" target="_blank" rel="noopener" class="contact-canal tiktok" title="Suivre sur TikTok">
          <div class="canal-icone icone-tiktok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.62h-3.14v13.2a3.08 3.08 0 0 1-5.5 1.9 3.08 3.08 0 0 1 3.32-4.97v-3.2a6.24 6.24 0 0 0-1.02-.08A6.28 6.28 0 1 0 15.28 15V9.4a9.34 9.34 0 0 0 5.44 1.74V8a5.84 5.84 0 0 1-4.12-2.18Z"/></svg>
          </div>
          <div class="canal-texte">
            <span class="canal-label">TikTok</span>
            <b class="canal-valeur">@serverorbismc</b>
          </div>
        </a>` : ''}
      </div>

      <div class="contact-delai">
        <span class="point-vert-delai"></span>
        <div><b>Délai moyen de réponse :</b> sous 24 à 48 h ouvrées.</div>
      </div>
    </div>

    <div class="contact-carte contact-form-carte">
      <div class="contact-titre-bloc">
        <h3>Envoyer un message</h3>
        <p class="contact-desc">Remplis ce formulaire court, nous te répondrons par email dès que possible.</p>
      </div>

      ${ok ? `<div class="avis succes" role="status"><span class="avis-icone">${iconeSvg('check', 18)}</span> Ton message a bien été envoyé ! Nous te répondrons par email très rapidement.</div>` : ''}
      ${erreur ? `<div class="avis erreur" role="alert"><span class="avis-icone">${iconeSvg('warning', 18)}</span> ${esc(erreur)}</div>` : ''}

      <form class="contact-formulaire" method="POST" action="/contact">
        <input type="hidden" name="_csrf" value="${esc(csrf)}">

        <div class="form-rangee-2">
          <div class="form-groupe">
            <label for="pseudo">Pseudo Minecraft <span class="mention-facultatif">(facultatif)</span></label>
            <input class="form-ctrl" type="text" id="pseudo" name="pseudo" placeholder="Ex: Steve" maxlength="16">
          </div>
          <div class="form-groupe">
            <label for="email">Ton email <span class="requis">*</span></label>
            <input class="form-ctrl" type="email" id="email" name="email" placeholder="ton.email@exemple.com" required maxlength="100">
          </div>
        </div>

        <div class="form-groupe">
          <label for="sujet">Sujet de ta demande <span class="requis">*</span></label>
          <select class="form-ctrl" id="sujet" name="sujet" required>
            <option value="Question générale">Question générale</option>
            <option value="Problème boutique ou gemmes">Problème boutique ou gemmes</option>
            <option value="Signalement bug ou joueur">Signalement bug ou joueur</option>
            <option value="Partenariat ou Créateur de contenu">Partenariat ou Créateur de contenu</option>
          </select>
        </div>

        <div class="form-groupe">
          <label for="message">Message détaillé <span class="requis">*</span></label>
          <textarea class="form-ctrl form-textarea" id="message" name="message" rows="4" placeholder="Explique-nous ta demande en détail..." required maxlength="2000"></textarea>
        </div>

        <button type="submit" class="btn btn-plein btn-violet btn-envoyer">Envoyer mon message</button>
      </form>
    </div>
  </div>
</div></section>`;
  return page({ titre:'Contact & Support',actif:'contact',corps,description:`Contacte l’équipe ${NOM} pour une question sur le serveur Minecraft, un problème de compte ou une commande de la boutique.` },res);
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
        <li><b>Empreinte de mot de passe (comptes non officiels) :</b> Pour les joueurs utilisant un mot de passe de protection, celui-ci est transformé par PBKDF2-HMAC-SHA256 avec un sel propre au compte. Aucun mot de passe n'est jamais stocké en clair.</li>
        <li><b>Adresse IP et journaux techniques :</b> Journalisées temporairement à des fins exclusives de sécurité, de prévention des attaques par déni de service (DDoS) et de limitation des abus.</li>
        <li><b>Messages de contact :</b> Votre adresse email et votre message lorsque vous utilisez le formulaire de contact ou nous écrivez par email, uniquement pour vous répondre.</li>
        <li><b>Adresse reliée au compte :</b> Si vous activez cette option, votre adresse vérifiée est associée à l’UUID Minecraft pour la connexion et la récupération de votre accès web. Le mot de passe web est haché avec PBKDF2 et un sel individuel. Les liens de confirmation (30 minutes) et de récupération (20 minutes) sont à usage unique ; seule leur empreinte est conservée. Les demandes expirées sont supprimées lors des demandes suivantes.</li>
      </ul>

      <h2>3. Données de paiement et Sécurité bancaire</h2>
      <p><b>${esc(NOM)} ne collecte, ne traite et ne stocke JAMAIS la moindre information bancaire ou numéro de carte de paiement.</b></p>
      <p>L'ensemble des règlements est traité directement sur l'infrastructure sécurisée et certifiée PCI-DSS de notre partenaire de paiement officiel <b>Tebex Limited</b> (ou PayPal / Stripe selon votre choix). Tebex nous transmet uniquement la confirmation de commande avec le pseudo du joueur et le montant acquis.</p>

      <h2>4. Cookies et Traceurs</h2>
      <p>Le site web d'OrbisMC applique une politique stricte de respect de la vie privée :</p>
      <ul>
        <li><b>Aucun cookie publicitaire</b> ni traceur de profilage ou de revente de données n'est utilisé.</li>
        <li>Un cookie technique de session sécurisé (<code>__Host-orbis_session</code> en HTTPS) protège les formulaires et maintient votre connexion. Le tableau de bord privé utilise aussi son cookie d'authentification technique ; aucun de ces cookies n'est publicitaire.</li>
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

  const corps = `${tetePage('Informations', titrePage, '')}<section class="page"><div class="enveloppe"><div class="panneau page-legale">${blocs}</div></div></section>`;
  return page({titre:titrePage,corps,description:`${titrePage} de ${NOM} : informations sur le site, les comptes et la boutique du serveur Minecraft.`},res);
}

module.exports = { categorieValide, accueil, rejoindre, jeu, classements, joueur, introuvable, connexion, inscription, identiteMail, compte, boutique, votes, legale, contact, wiki, definirCatalogue, ONGLETS, JEUX, ONGLETS_BOUTIQUE, CATEGORIES_COSMETIQUES:Object.keys(CATS) };


