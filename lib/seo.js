// Référencement : robots.txt, plan du site (sitemap.xml), manifeste d'application, security.txt, données structurées.
const config = require('./config');
const { esc } = require('./html');

const BASE = (config.urlPublique && !config.urlPublique.includes('localhost') && !config.urlPublique.includes('127.0.0.1'))
  ? String(config.urlPublique).replace(/\/$/, '')
  : 'https://mcorbis.com';
const JEUX = ['td', 'lethal', 'donjon', 'duel'];
const CLASSEMENTS = ['td', 'vague', 'raids', 'lethal', 'ferraille', 'donjon', 'duel', 'temps'];

function url(chemin) {
  return `${BASE}${chemin}`;
}

function robots() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /compte',
    'Disallow: /connexion',
    'Disallow: /deconnexion',
    'Disallow: /boutique/payer',
    'Disallow: /boutique/cosmetique',
    'Disallow: /api/',
    'Disallow: /pack/',
    'Disallow: /bi-analytics-9834x',
    '',
    `Sitemap: ${url('/sitemap.xml')}`,
    '',
  ].join('\n');
}

function plan(joueurs) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const pages = [
    ['/', 'daily', '1.0'],
    ...JEUX.map((j) => [`/jeux/${j}`, 'weekly', '0.9']),
    ['/boutique', 'weekly', '0.8'], ['/boutique/gemmes', 'weekly', '0.7'], ['/boutique/cosmetiques', 'weekly', '0.7'],
    ['/votes', 'weekly', '0.7'],
    ['/classements', 'hourly', '0.7'], ...CLASSEMENTS.filter((c) => c !== 'td').map((c) => [`/classements/${c}`, 'hourly', '0.5']),
    ['/mentions-legales', 'yearly', '0.2'], ['/confidentialite', 'yearly', '0.2'], ['/cgv', 'yearly', '0.2'],
    ['/contact', 'monthly', '0.6'],
  ];
  const lignes = pages.map(([chemin, freq, prio]) => `<url><loc>${esc(url(chemin))}</loc><lastmod>${aujourdhui}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`);
  for (const j of joueurs) {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(j.pseudo)) continue;
    const mod = new Date(Number(j.derniere) || Date.now()).toISOString().slice(0, 10);
    lignes.push(`<url><loc>${esc(url(`/joueur/${j.pseudo}`))}</loc><lastmod>${mod}</lastmod><changefreq>weekly</changefreq><priority>0.3</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lignes.join('\n')}\n</urlset>\n`;
}

function manifeste() {
  return JSON.stringify({
    name: config.nomServeur,
    short_name: config.nomServeur,
    description: `Serveur Minecraft Java ${config.versionJeu} : quatre jeux originaux.`,
    lang: 'fr',
    start_url: '/',
    display: 'browser',
    background_color: '#f6f4fb',
    theme_color: '#5b2fd1',
    icons: [
      { src: '/img/marque/embleme-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/img/marque/embleme-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}

function securityTxt() {
  const expire = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const contact = config.contactSecurite || (config.discord ? config.discord : `${BASE}/mentions-legales`);
  return `Contact: ${contact}\nExpires: ${expire}\nPreferred-Languages: fr, en\nCanonical: ${url('/.well-known/security.txt')}\n`;
}

// Bloc JSON-LD sûr : aucun « < » ne peut refermer la balise <script>.
function jsonLd(objet) {
  return `<script type="application/ld+json">${JSON.stringify(objet).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}</script>`;
}

function fil(etapes) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [['Accueil', '/'], ...etapes].map(([nom, chemin], k) => ({ '@type': 'ListItem', position: k + 1, name: nom, item: url(chemin) })),
  };
}

module.exports = { BASE, url, robots, plan, manifeste, securityTxt, jsonLd, fil };
