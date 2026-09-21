// Site du serveur : présentation, classements, profils, connexion avec le compte du jeu, boutique.
// Lancement : node serveur.js (LANCER.bat le fait). Réglages : config.json.
const path = require('path');
const express = require('express');
const compression = require('compression');
const config = require('./lib/config');
const session = require('./lib/session');
const securite = require('./lib/securite');
const comptes = require('./lib/comptes');
const donnees = require('./lib/donnees');
const minecraft = require('./lib/minecraft');
const tebex = require('./lib/tebex');
const mm = require('./lib/mm');
const vues = require('./lib/vues');
const seo = require('./lib/seo');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Détecte le vrai IP visiteur et HTTPS derrière Vercel / Nginx
app.set('etag', 'strong');

app.use(securite.entetes);
app.use(securite.methodes);
app.use(securite.debit({ max: 600, maxPost: 40, fenetreMs: 60 * 1000 }));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  dotfiles: 'ignore',
  redirect: false,
  cacheControl: false,
  // Fichiers versionnés (?v=…) : un an ; le reste : une heure.
  setHeaders: (res) => res.setHeader('Cache-Control', res.req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'),
}));
app.use(express.urlencoded({ extended: false, limit: '8kb', parameterLimit: 20 }));
app.use(securite.origineSure);
app.use(session.middleware);

const tentativesIp = securite.limiteur(10, 10 * 60 * 1000);
const tentativesPseudo = securite.limiteur(8, 15 * 60 * 1000);
const ip = (req) => req.ip || req.socket.remoteAddress;
const champ = (req, nom, max) => (typeof req.body[nom] === 'string' ? req.body[nom].slice(0, max) : '');
const requeteTexte = (req, nom, max) => (typeof req.query[nom] === 'string' ? req.query[nom].slice(0, max) : '');
// Toute route asynchrone : une erreur de base de données donne une page propre, jamais une trace.
const asyncr = (f) => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

// Catalogue des cosmétiques (couleurs, titres), relu toutes les 5 minutes.
let catalogue = [];
let cssCosmetiques = '';
async function chargerCatalogue() {
  try {
    catalogue = await donnees.catalogue();
    cssCosmetiques = mm.css(catalogue);
    vues.definirCatalogue(catalogue);
  } catch (e) {
    console.error('Catalogue illisible :', e.message);
  }
}
chargerCatalogue();
setInterval(chargerCatalogue, 5 * 60 * 1000).unref();

app.get('/css/cosmetiques.css', (req, res) => res.type('text/css').set('Cache-Control', 'public, max-age=300').send(cssCosmetiques));

// ------------------------------------------------------------------ référencement

app.get('/robots.txt', (req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(seo.robots()));
app.get('/sitemap.xml', asyncr(async (req, res) => {
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(seo.plan(await donnees.joueursRecents(500)));
}));
app.get('/site.webmanifest', (req, res) => res.type('application/manifest+json').set('Cache-Control', 'public, max-age=86400').send(seo.manifeste()));
app.get('/google3ebe9a7838b68fc4.html', (req, res) => res.type('text/html').send('google-site-verification: google3ebe9a7838b68fc4.html'));
app.get('/.well-known/security.txt', (req, res) => res.type('text/plain').send(seo.securityTxt()));

// ------------------------------------------------------------------ pages publiques

app.get('/', asyncr(async (req, res) => {
  const [statut, chiffres, topElo, topVague, topQuotas, equipe, topDonjon, topDuel] = await Promise.all([
    minecraft.statut(), donnees.chiffres(), donnees.classement('td_elo', 5), donnees.classement('td_record', 5),
    donnees.classement('lethal_quotas', 5), donnees.equipe(), donnees.classement('donjon_victoires', 1), donnees.classement('duel_victoires', 1),
  ]);
  const records = { td: topVague[0], lethal: topQuotas[0], donjon: topDonjon[0], duel: topDuel[0] };
  res.send(vues.accueil(res, { statut, chiffres, topElo, topVague, topQuotas, equipe, records }));
}));

app.get('/jeux/:id', asyncr(async (req, res) => {
  const id = req.params.id;
  if (!Object.hasOwn(vues.JEUX, id)) return res.status(404).send(vues.introuvable(res, "Ce jeu n'existe pas."));
  const [statut, ...tops] = await Promise.all([minecraft.statut(), ...vues.JEUX[id].classements.map(([cle]) => donnees.classement(cle, 5))]);
  res.send(vues.jeu(res, id, { statut, tops }));
}));

app.get('/votes', asyncr(async (req, res) => res.send(vues.votes(res, { statut: await minecraft.statut() }))));
app.get(['/wiki', '/commandes'], (req, res) => res.send(vues.wiki(res)));

app.get('/api/statut', asyncr(async (req, res) => res.set('Cache-Control', 'public, max-age=15').json(await minecraft.statut())));

app.get(['/classements', '/classements/:onglet'], asyncr(async (req, res) => {
  const demande = req.params.onglet;
  if (demande !== undefined && !Object.hasOwn(vues.ONGLETS, demande)) return res.status(404).send(vues.introuvable(res));
  const onglet = demande || 'td';
  const o = vues.ONGLETS[onglet];
  const lignes = o.cle ? await donnees.classement(o.cle, 50) : await donnees.classementTemps(50);
  res.send(vues.classements(res, onglet, lignes));
}));

app.get('/joueur/:pseudo', asyncr(async (req, res) => {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(req.params.pseudo)) return res.status(404).send(vues.introuvable(res, 'Ce joueur est inconnu.'));
  const p = await donnees.profilPublic(req.params.pseudo);
  if (!p) return res.status(404).send(vues.introuvable(res, "Ce joueur ne s'est jamais connecté."));
  res.send(vues.joueur(res, p));
}));

app.get('/mentions-legales', (req, res) => res.send(vues.legale(res, 'mentions')));
app.get('/cgv', (req, res) => res.send(vues.legale(res, 'cgv')));

// ------------------------------------------------------------------ connexion

app.get('/connexion', (req, res) => {
  if (req.session) return res.redirect(303, '/compte');
  res.send(vues.connexion(res, { code: requeteTexte(req, 'code', 8).replace(/[^A-Za-z0-9]/g, ''), pseudo: requeteTexte(req, 'pseudo', 16).replace(/[^A-Za-z0-9_]/g, '') }));
});

app.post('/connexion', session.verifierCsrf, asyncr(async (req, res) => {
  const pseudo = champ(req, 'pseudo', 16);
  const cleP = pseudo.toLowerCase();
  if (tentativesIp.bloque(ip(req)) || tentativesPseudo.bloque(cleP)) {
    return res.status(429).send(vues.connexion(res, { erreur: 'Trop de tentatives. Réessaie dans quelques minutes.' }));
  }
  const r = await comptes.parMotDePasse(pseudo, champ(req, 'mdp', 65));
  if (r.erreur) {
    tentativesIp.echec(ip(req));
    tentativesPseudo.echec(cleP);
    return res.status(401).send(vues.connexion(res, { erreur: r.erreur, pseudo: pseudo.replace(/[^A-Za-z0-9_]/g, '') }));
  }
  tentativesIp.reussite(ip(req));
  tentativesPseudo.reussite(cleP);
  session.connecter(req, res, r.joueur);
  res.redirect(303, '/compte');
}));

app.post('/connexion/code', session.verifierCsrf, asyncr(async (req, res) => {
  if (tentativesIp.bloque(ip(req))) return res.status(429).send(vues.connexion(res, { erreur: 'Trop de tentatives. Réessaie dans quelques minutes.' }));
  const r = await comptes.parCode(champ(req, 'code', 16));
  if (r.erreur) {
    tentativesIp.echec(ip(req));
    return res.status(401).send(vues.connexion(res, { erreur: r.erreur }));
  }
  tentativesIp.reussite(ip(req));
  session.connecter(req, res, r.joueur);
  res.redirect(303, '/compte');
}));

app.post('/deconnexion', session.verifierCsrf, (req, res) => {
  session.deconnecter(req, res);
  res.redirect(303, '/');
});

// Espace connecté : la session doit toujours correspondre au compte (mot de passe inchangé, compte existant).
const connecte = asyncr(async (req, res, next) => {
  if (!req.session) return res.redirect(303, '/connexion');
  if (!(await comptes.sessionValide(req.session))) {
    session.deconnecter(req, res);
    return res.redirect(303, '/connexion');
  }
  next();
});

// ------------------------------------------------------------------ compte

app.get('/compte', connecte, asyncr(async (req, res) => {
  const p = await donnees.profilPrive(req.session.uuid);
  if (!p) {
    session.deconnecter(req, res);
    return res.redirect(303, '/connexion');
  }
  res.send(vues.compte(res, {
    p, catalogue, cat: requeteTexte(req, 'cat', 20),
    message: req.query.achat === 'merci' ? 'merci' : requeteTexte(req, 'ok', 20),
    erreur: requeteTexte(req, 'erreur', 20),
  }));
}));

app.post('/compte/equiper', connecte, session.verifierCsrf, asyncr(async (req, res) => {
  const r = await donnees.equiper(req.session.uuid, champ(req, 'id', 48));
  const cat = vues.categorieValide(champ(req, 'cat', 20));
  res.redirect(303, `/compte?cat=${cat}&${r.ok ? `ok=${r.ok}` : `erreur=${r.erreur}`}#cosmetiques`);
}));

// ------------------------------------------------------------------ boutique

app.get(['/boutique', '/boutique/:onglet'], asyncr(async (req, res) => {
  const onglet = req.params.onglet || 'grades';
  if (!Object.hasOwn(vues.ONGLETS_BOUTIQUE, onglet)) return res.status(404).send(vues.introuvable(res));
  let offres;
  try {
    offres = await tebex.offres();
  } catch (e) {
    console.error('Tebex :', e.message);
    offres = { actif: false, offres: [] };
  }
  const p = req.session && (await comptes.sessionValide(req.session)) ? await donnees.profilPrive(req.session.uuid) : null;
  res.send(vues.boutique(res, {
    onglet, cat: requeteTexte(req, 'cat', 20), offres, catalogue, p,
    message: requeteTexte(req, 'ok', 20), erreur: requeteTexte(req, 'erreur', 20), id: requeteTexte(req, 'id', 48),
  }));
}));

app.post('/boutique/cosmetique', connecte, session.verifierCsrf, asyncr(async (req, res) => {
  const id = champ(req, 'id', 48);
  const r = await donnees.acheterCosmetique(req.session.uuid, id);
  const cat = vues.categorieValide(champ(req, 'cat', 20));
  res.redirect(303, `/boutique/cosmetiques?cat=${cat}&${r.ok ? `ok=${r.ok}&id=${encodeURIComponent(id)}` : `erreur=${r.erreur}`}`);
}));

app.post('/boutique/payer', connecte, session.verifierCsrf, asyncr(async (req, res) => {
  const offre = champ(req, 'offre', 12);
  if (!/^\d{1,12}$/.test(offre)) return res.redirect(303, '/boutique/gemmes?erreur=offre');
  try {
    const url = await tebex.paiement(offre, req.session.pseudo);
    if (!url || !/^https:\/\/[a-z0-9.-]+\.tebex\.io\//i.test(url)) throw new Error('adresse de paiement inattendue');
    res.redirect(303, url);
  } catch (e) {
    console.error('Paiement :', e.message);
    res.redirect(303, '/boutique/gemmes?erreur=paiement');
  }
}));

// ------------------------------------------------------------------ erreurs

app.use((req, res) => res.status(404).send(vues.introuvable(res)));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // Corps de formulaire trop gros ou mal formé : refus simple, sans trace.
  if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed' || err.status === 400 || err.status === 413) {
    return res.status(err.status || 400).type('text/plain').send('Requête invalide.');
  }
  console.error(err);
  res.status(500).send(vues.introuvable(res, 'Le site a un souci passager. Réessaie dans un instant.'));
});

if (require.main === module) {
  app.listen(config.port, () => console.log(`Site en ligne : http://localhost:${config.port}`));
}

module.exports = app;
