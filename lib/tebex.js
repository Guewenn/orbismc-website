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
  { id: 'demo-1', name: '1 000 gemmes', gemmes: 1000, total_price: 2.99, currency: 'EUR', sous: 'Pack Découverte' },
  { id: 'demo-2', name: '3 000 gemmes', gemmes: 3000, total_price: 5.99, currency: 'EUR', sous: 'Pack Aventure' },
  { id: 'demo-3', name: '10 000 gemmes', gemmes: 10000, total_price: 17.99, currency: 'EUR', sous: 'Idéal Grade VIP' },
  { id: 'demo-4', name: '20 000 gemmes', gemmes: 20000, total_price: 32.99, currency: 'EUR', populaire: true, sous: 'Idéal Grade Élite' },
  { id: 'demo-5', name: '40 000 gemmes', gemmes: 40000, total_price: 59.99, currency: 'EUR', sous: 'Idéal Grade Légende' },
  { id: 'demo-6', name: '70 000 gemmes', gemmes: 70000, total_price: 99.99, currency: 'EUR', meilleur: true, sous: 'Pack Ultime' },
];


let cache = { a: 0, offres: null };
let chargement = null;
let prochainEssai = 0;
const indisponible = () => ({ actif: false, offres: EXEMPLES });
const appeler = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) });

async function offres() {
  if (!jeton()) return { actif: false, offres: EXEMPLES };
  if (cache.offres && Date.now() - cache.a < 5 * 60000) return { actif: true, offres: cache.offres };
  if (Date.now() < prochainEssai) return indisponible();
  if (chargement) return chargement;
  chargement = chargerOffres();
  try { return await chargement; } finally { chargement = null; }
}

async function chargerOffres() {
  try {
    const r = await appeler(`${API}/accounts/${jeton()}/categories?includePackages=1`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Tebex ${r.status}`);
    const json = await r.json();
    if (!Array.isArray(json.data)) throw new Error('Catalogue Tebex invalide');
    const uniques = new Map();
    for (const cat of json.data) for (const p of cat.packages || []) {
      if (/^\d{1,12}$/.test(String(p.id))) uniques.set(String(p.id), p);
    }
    const liste = [...uniques.values()];
    cache = { a: Date.now(), offres: liste };
    return { actif: true, offres: liste };
  } catch {
    prochainEssai = Date.now() + 30000;
    return indisponible();
  }
}

// Crée un panier Tebex au nom du joueur et renvoie l'adresse de paiement.
async function paiement(idOffre, pseudo) {
  if (!jeton()) throw new Error('Boutique non configurée');
  const catalogue = await offres();
  if (!catalogue.actif || !catalogue.offres.some((p) => String(p.id) === String(idOffre))) {
    throw new Error('Offre indisponible');
  }
  const base = config.urlPublique.replace(/\/$/, '');
  const panier = await appeler(`${API}/accounts/${jeton()}/baskets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: pseudo, complete_url: `${base}/compte?achat=merci`, cancel_url: `${base}/boutique`, complete_auto_redirect: true }),
  });
  if (!panier.ok) throw new Error(`Tebex panier ${panier.status}`);
  const donnees = (await panier.json()).data;
  if (!donnees || typeof donnees.ident !== 'string' || !/^[\w-]+$/.test(donnees.ident)) throw new Error('Panier Tebex invalide');
  const ajout = await appeler(`${API}/baskets/${donnees.ident}/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ package_id: Number(idOffre), quantity: 1 }),
  });
  if (!ajout.ok) throw new Error(`Tebex offre ${ajout.status}`);
  const final = (await ajout.json()).data || donnees;
  return (final.links && final.links.checkout) || (donnees.links && donnees.links.checkout);
}

module.exports = { offres, paiement };
