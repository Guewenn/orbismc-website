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
const bi = require('./lib/bi');
const courriel = require('./lib/courriel');
const identiteMail = require('./lib/identite-mail');
const base = require('./lib/base');
const tentativesMail = securite.limiteur(4, 30 * 60 * 1000);

const app = express();
app.disable('x-powered-by');
// Vercel, Render ou Cloudflare gèrent leur entrée HTTPS.
app.set('trust proxy', 1);
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
const tentativesBi = securite.limiteur(10, 10 * 60 * 1000);
const ip = (req) => req.ip || req.socket.remoteAddress;
const champ = (req, nom, max) => (typeof req.body[nom] === 'string' ? req.body[nom].slice(0, max) : '');
const requeteTexte = (req, nom, max) => (typeof req.query[nom] === 'string' ? req.query[nom].slice(0, max) : '');
// Toute route asynchrone : une erreur de base de données donne une page propre, jamais une trace.
const asyncr = (f) => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

// Catalogue des cosmétiques (couleurs, titres), relu toutes les 5 minutes.
let catalogue = require('./lib/catalogue-public.json');
let cssCosmetiques = mm.css(catalogue);
vues.definirCatalogue(catalogue);
let catalogueDisponible = false;
let catalogueLu = 0;
let lectureCatalogue = null;
async function chargerCatalogue() {
  if (Date.now() - catalogueLu < 5 * 60000) return;
  if (!lectureCatalogue) lectureCatalogue = donnees.catalogue().then((articles) => {
    catalogue = articles;
    cssCosmetiques = mm.css(catalogue);
    vues.definirCatalogue(catalogue);
    catalogueDisponible = true;
    catalogueLu = Date.now();
  }).catch((e) => {
    catalogueDisponible = false;
    console.error('Catalogue illisible :', e.message);
    catalogueLu = Date.now() - 5 * 60000 + 30000;
  }).finally(() => { lectureCatalogue = null; });
  await lectureCatalogue;
}

app.get('/css/cosmetiques.css', asyncr(async (req, res) => {
  await chargerCatalogue();
  res.type('text/css').set('Cache-Control', 'public, max-age=300, s-maxage=300').send(cssCosmetiques);
}));

// ------------------------------------------------------------------ référencement

app.get('/robots.txt', (req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(seo.robots()));
app.get('/sitemap.xml', asyncr(async (req, res) => {
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(seo.plan(await donnees.joueursRecents(500),vues.CATEGORIES_COSMETIQUES));
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
app.get('/wiki', (req, res) => res.send(vues.wiki(res)));
app.get('/commandes', (req,res)=>res.redirect(301,'/wiki'));
app.get('/rejoindre',(req,res)=>res.send(vues.rejoindre(res)));

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

app.get('/contact', (req, res) => {
  res.send(vues.contact(res, { ok: req.query.ok === '1', erreur: requeteTexte(req, 'erreur', 50) }));
});

app.post('/contact', session.verifierCsrf, asyncr(async (req, res) => {
  const email = champ(req, 'email', 100).trim();
  const sujet = champ(req, 'sujet', 60).trim();
  const message = champ(req, 'message', 2000).trim();
  const pseudo = champ(req, 'pseudo', 16).trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message || message.length < 5) {
    return res.status(400).send(vues.contact(res, { erreur: 'Merci de renseigner une adresse email valide et un message explicite.' }));
  }

  console.log(`[NOUVEAU CONTACT] De: ${pseudo || 'Anonyme'} <${email}> | Sujet: ${sujet} | Reçu le: ${new Date().toISOString()}`);

  try {
    const resultat = await courriel.envoyerContact({
      pseudo,
      email,
      sujet,
      message,
      ip: req.ip,
    });

    if (!resultat.succes) {
      console.error('[CONTACT] Échec envoi email :', resultat.erreur);
      return res.status(500).send(vues.contact(res, {
        erreur: "Impossible d'envoyer votre message pour le moment. Vous pouvez nous écrire directement à contact.orbis.server@gmail.com."
      }));
    }

    res.redirect(303, '/contact?ok=1');
  } catch (err) {
    console.error('[CONTACT] Erreur inattendue :', err);
    return res.status(500).send(vues.contact(res, {
      erreur: "Une erreur est survenue lors de l'envoi de votre message. Vous pouvez nous écrire directement à contact.orbis.server@gmail.com."
    }));
  }
}));

app.get('/mentions-legales', (req, res) => res.send(vues.legale(res, 'mentions')));
app.get('/confidentialite', (req, res) => res.send(vues.legale(res, 'confidentialite')));
app.get('/cgv', (req, res) => res.send(vues.legale(res, 'cgv')));

// ------------------------------------------------------------------ dashboard bi secret
app.get('/bi-analytics-9834x', asyncr(async (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'private, no-store');
  if (!bi.verifierAuth(req)) {
    return res.send(bi.vueLogin(res));
  }
  const donnees = await bi.chargerDonnees();
  res.send(bi.vueDashboard(donnees, res));
}));

app.post('/bi-analytics-9834x', session.verifierCsrf, asyncr(async (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'private, no-store');
  if (req.body.deconnexion === '1') {
    res.append('Set-Cookie', `${bi.NOM_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${req.secure ? '; Secure' : ''}`);
    return res.redirect(303, '/bi-analytics-9834x');
  }
  if (tentativesBi.bloque(ip(req))) return res.status(429).send(bi.vueLogin(res, 'Trop de tentatives. Réessaie dans quelques minutes.'));
  const mdp = champ(req, 'mdp', 100);
  if (!bi.verifierMotDePasse(mdp)) {
    tentativesBi.echec(ip(req));
    return res.status(401).send(bi.vueLogin(res, 'Mot de passe incorrect.'));
  }
  tentativesBi.reussite(ip(req));
  res.append('Set-Cookie', `${bi.NOM_COOKIE}=${bi.signerAuth()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(bi.DUREE_COOKIE / 1000)}${req.secure ? '; Secure' : ''}`);
  res.redirect(303, '/bi-analytics-9834x');
}));

// ------------------------------------------------------------------ connexion

app.get('/connexion', asyncr(async (req, res) => {
  if (req.session) return res.redirect(303, '/compte');
  res.send(vues.connexion(res, { disponible:await base.disponible(), code: requeteTexte(req, 'code', 8).replace(/[^A-Za-z0-9]/g, ''), pseudo: requeteTexte(req, 'pseudo', 16).replace(/[^A-Za-z0-9_]/g, '') }));
}));

app.get('/inscription', asyncr(async(req,res)=>{
  if(req.session) return res.redirect(303,'/compte/mail');
  res.send(vues.inscription(res,{disponible:await base.disponible(),mailDisponible:courriel.securiteDisponible()}));
}));
app.post('/inscription', session.verifierCsrf, asyncr(async(req,res)=>{
  if(tentativesMail.bloque(ip(req))) return res.status(429).send(vues.inscription(res,{erreur:'Trop de demandes. Réessaie dans 30 minutes.'}));
  if(!(await base.disponible())) return res.status(503).send(vues.inscription(res,{disponible:false,mailDisponible:courriel.securiteDisponible()}));
  if(!courriel.securiteDisponible()) return res.status(503).send(vues.inscription(res,{mailDisponible:false}));
  tentativesMail.echec(ip(req));
  const email=champ(req,'email',255), mdp=champ(req,'mdp',65);
  // Un champ invalide ne consomme pas le code à usage unique obtenu en jeu.
  if(!identiteMail.normaliser(email)) return res.status(400).send(vues.inscription(res,{erreur:'Adresse mail invalide.'}));
  if(!identiteMail.motDePasseValide(mdp)) return res.status(400).send(vues.inscription(res,{erreur:'Choisis un mot de passe web de 12 à 64 caractères.'}));
  const preuve=await comptes.parCode(champ(req,'code',16));
  if(!preuve.joueur) return res.status(400).send(vues.inscription(res,{erreur:preuve.erreur}));
  const resultat=await identiteMail.demanderLiaison(preuve.joueur.uuid,email,mdp);
  if(!resultat.erreur) session.connecter(req,res,preuve.joueur);
  res.status(resultat.erreur?400:200).send(vues.inscription(res,resultat));
}));

app.post('/connexion', session.verifierCsrf, asyncr(async (req, res) => {
  if(!(await base.disponible())) return res.status(503).send(vues.connexion(res,{disponible:false}));
  const pseudo = champ(req, 'pseudo', 255).trim();
  const cleP = pseudo.toLowerCase();
  if (tentativesIp.bloque(ip(req)) || tentativesPseudo.bloque(cleP)) {
    return res.status(429).send(vues.connexion(res, { erreur: 'Trop de tentatives. Réessaie dans quelques minutes.' }));
  }
  const r = await comptes.parMotDePasse(pseudo, champ(req, 'mdp', 65));
  if (r.erreur) {
    tentativesIp.echec(ip(req));
    tentativesPseudo.echec(cleP);
    return res.status(401).send(vues.connexion(res, { erreur: r.erreur, pseudo }));
  }
  tentativesIp.reussite(ip(req));
  tentativesPseudo.reussite(cleP);
  session.connecter(req, res, r.joueur);
  res.redirect(303, '/compte');
}));

app.post('/connexion/code', session.verifierCsrf, asyncr(async (req, res) => {
  if(!(await base.disponible())) return res.status(503).send(vues.connexion(res,{disponible:false}));
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
  if(!(await base.disponible())) return res.status(503).send(vues.connexion(res,{disponible:false}));
  if (!(await comptes.sessionValide(req.session))) {
    session.deconnecter(req, res);
    return res.redirect(303, '/connexion');
  }
  next();
});

// ------------------------------------------------------------------ compte

app.get('/compte', connecte, asyncr(async (req, res) => {
  await chargerCatalogue();
  const p = await donnees.profilPrive(req.session.uuid);
  if (!p) {
    session.deconnecter(req, res);
    return res.redirect(303, '/connexion');
  }
  res.send(vues.compte(res, {
    p, catalogue, identite: await identiteMail.lire(req.session.uuid), mailDisponible: courriel.securiteDisponible(), cat: requeteTexte(req, 'cat', 20),
    message: req.query.achat === 'merci' ? 'merci' : requeteTexte(req, 'ok', 20),
    erreur: requeteTexte(req, 'erreur', 20),
  }));
}));

app.get('/compte/mail', connecte, (req, res) => res.send(vues.identiteMail(res, { mode: 'lier', disponible: courriel.securiteDisponible() })));
app.post('/compte/mail', connecte, session.verifierCsrf, asyncr(async (req, res) => {
  const cle = `${ip(req)}:${req.session.uuid}`;
  if (tentativesMail.bloque(cle)) return res.status(429).send(vues.identiteMail(res, { mode: 'lier', erreur: 'Trop de demandes. Réessaie dans 30 minutes.' }));
  tentativesMail.echec(cle);
  // Prouver à nouveau la possession du compte en jeu, même avec une session web déjà ouverte.
  const preuve = await comptes.parCode(champ(req, 'code', 16));
  if (!preuve.joueur || preuve.joueur.uuid !== req.session.uuid) return res.status(400).send(vues.identiteMail(res, { mode: 'lier', erreur: 'Tape /site en jeu et saisis un code neuf appartenant à ce même compte.' }));
  const resultat = await identiteMail.demanderLiaison(req.session.uuid, champ(req, 'email', 255), champ(req, 'mdp', 65));
  res.status(resultat.erreur ? 400 : 200).send(vues.identiteMail(res, { mode: 'lier', ...resultat }));
}));
app.get('/compte/mail/confirmer', connecte, (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  res.send(vues.identiteMail(res, { mode: 'confirmer', jeton: requeteTexte(req, 'jeton', 44) }));
});
app.post('/compte/mail/confirmer', connecte, session.verifierCsrf, asyncr(async (req, res) => {
  const resultat = await identiteMail.confirmer(champ(req, 'jeton', 44), req.session.uuid);
  if (!resultat.erreur) session.deconnecter(req, res);
  res.status(resultat.erreur ? 400 : 200).send(vues.identiteMail(res, { mode: 'resultat', ...resultat }));
}));
app.get('/connexion/recuperer', (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  const jeton = requeteTexte(req, 'jeton', 44);
  res.send(vues.identiteMail(res, { mode: jeton ? 'reinitialiser' : 'recuperer', jeton }));
});
app.post('/connexion/recuperer', session.verifierCsrf, asyncr(async (req, res) => {
  if (tentativesMail.bloque(ip(req))) return res.status(429).send(vues.identiteMail(res, { mode: 'recuperer', erreur: 'Trop de demandes. Réessaie dans 30 minutes.' }));
  tentativesMail.echec(ip(req));
  const resultat = await identiteMail.recuperer(champ(req, 'email', 255));
  res.send(vues.identiteMail(res, { mode: 'resultat', ...resultat }));
}));
app.post('/connexion/reinitialiser', session.verifierCsrf, asyncr(async (req, res) => {
  if (tentativesIp.bloque(ip(req))) return res.status(429).send(vues.identiteMail(res, { mode: 'resultat', erreur: 'Trop de tentatives. Réessaie dans quelques minutes.' }));
  tentativesIp.echec(ip(req));
  const jeton = champ(req, 'jeton', 44), mdp = champ(req, 'mdp', 65);
  if (!identiteMail.motDePasseValide(mdp)) return res.status(400).send(vues.identiteMail(res, { mode: 'reinitialiser', jeton, erreur: 'Choisis un mot de passe de 12 à 64 caractères.' }));
  const resultat = await identiteMail.confirmer(jeton, null, mdp);
  if (!resultat.erreur) { tentativesIp.reussite(ip(req)); session.deconnecter(req, res); }
  res.status(resultat.erreur ? 400 : 200).send(vues.identiteMail(res, { mode: 'resultat', ...resultat }));
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
  await chargerCatalogue();
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
    recherche: requeteTexte(req, 'q', 80), filtre: requeteTexte(req, 'filtre', 20),
    catalogueDisponible,
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
    const pseudoLivraison = await comptes.destinataire(req.session.uuid);
    if (!pseudoLivraison) throw new Error('Compte Minecraft introuvable');
    const url = await tebex.paiement(offre, pseudoLivraison);
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
  console.error('Requête échouée :', err.code || err.name || 'erreur');
  if(base.erreurDisponibilite(err) && /^(\/connexion|\/inscription|\/compte)(\/|$)/.test(req.path)) {
    base.signalerIndisponibilite();
    res.set('Retry-After','30');
    return res.status(503).send(req.path==='/inscription' ? vues.inscription(res,{disponible:false}) : vues.connexion(res,{disponible:false}));
  }
  res.status(500).send(vues.introuvable(res, 'Le site a un souci passager. Réessaie dans un instant.'));
});

if (require.main === module) {
  const hote = process.env.HOST || '0.0.0.0';
  app.listen(config.port, hote, () => console.log(`Site en ligne : http://${hote}:${config.port}`));
}

module.exports = app;
