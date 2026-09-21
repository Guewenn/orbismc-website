// Boutique en euros via Tebex (partenaire officiel de Mojang pour la monétisation des serveurs).
// Tebex encaisse, gère la TVA et les litiges, puis exécute sur le serveur les commandes réglées dans
// son panneau (ex. « gemmes donner {username} 500 Achat Tebex »). Le site ne voit jamais de carte bancaire.
//
// Sans jeton (config.tebex.jetonBoutique vide), la boutique s'affiche en « bientôt disponible ».
const config = require('./config');

const API = 'https://headless.tebex.io/api';
const jeton = () => (config.tebex && config.tebex.jetonBoutique) || '';

// Offres d'exemple affichées tant que Tebex n'est pas branché (aucun achat possible).
const EXEMPLES = [
  { id: 'demo-1', name: '1 000 gemmes', gemmes: 1000, total_price: 2.99, currency: 'EUR' },
  { id: 'demo-2', name: '2 500 gemmes', gemmes: 2500, total_price: 5.99, currency: 'EUR' },
  { id: 'demo-3', name: '5 000 gemmes', gemmes: 5000, total_price: 11.99, currency: 'EUR', meilleur: true },
  { id: 'demo-4', name: '10 000 gemmes', gemmes: 10000, total_price: 21.99, currency: 'EUR' },
  { id: 'demo-5', name: '25 000 gemmes', gemmes: 25000, total_price: 49.99, currency: 'EUR' },
  { id: 'demo-6', name: '100 000 gemmes', gemmes: 100000, total_price: 149.99, currency: 'EUR' },
];


let cache = { a: 0, offres: null };

async function offres() {
  if (!jeton()) return { actif: false, offres: EXEMPLES };
  if (cache.offres && Date.now() - cache.a < 5 * 60000) return { actif: true, offres: cache.offres };
  const r = await fetch(`${API}/accounts/${jeton()}/categories?includePackages=1`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Tebex ${r.status}`);
  const json = await r.json();
  const liste = [];
  for (const cat of json.data || []) for (const p of cat.packages || []) liste.push(p);
  cache = { a: Date.now(), offres: liste };
  return { actif: true, offres: liste };
}

// Crée un panier Tebex au nom du joueur et renvoie l'adresse de paiement.
async function paiement(idOffre, pseudo) {
  if (!jeton()) throw new Error('Boutique non configurée');
  const base = config.urlPublique.replace(/\/$/, '');
  const panier = await fetch(`${API}/accounts/${jeton()}/baskets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: pseudo, complete_url: `${base}/compte?achat=merci`, cancel_url: `${base}/boutique`, complete_auto_redirect: true }),
  });
  if (!panier.ok) throw new Error(`Tebex panier ${panier.status}`);
  const donnees = (await panier.json()).data;
  const ajout = await fetch(`${API}/baskets/${donnees.ident}/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ package_id: Number(idOffre), quantity: 1 }),
  });
  if (!ajout.ok) throw new Error(`Tebex offre ${ajout.status}`);
  const final = (await ajout.json()).data || donnees;
  return (final.links && final.links.checkout) || (donnees.links && donnees.links.checkout);
}

module.exports = { offres, paiement };
