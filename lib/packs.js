// Les possessions dérivées évitent de revendre un cosmétique déjà inclus dans un pack.
const EXCLUSIFS = require('./packs-contenus.json');
function valeurs(c) {
  if (!(c.categorie === 'FETE' || c.categorie.startsWith('UC_')) || String(c.valeur).startsWith('bientot:')) return [];
  return String(c.valeur).split(',').map(v => v.trim()).filter(Boolean);
}
function couvre(permission, valeur) {
  return permission === valeur || (permission.endsWith('.*') && valeur.startsWith(permission.slice(0,-1)));
}
function possessions(ids, catalogue) {
  const resultat = new Set(ids);
  const permissions = catalogue.filter(c => resultat.has(c.id)).flatMap(valeurs);
  for (const c of catalogue) {
    const contenu = valeurs(c);
    if (contenu.length && contenu.every(v => permissions.some(p => couvre(p,v)))) resultat.add(c.id);
  }
  return resultat;
}
function contenu(pack, catalogue) {
  return valeurs(pack).map(v => catalogue.find(c => c.categorie !== 'FETE' && valeurs(c).length === 1 && valeurs(c)[0] === v && (!c.monnaie || c.monnaie === 'GEMMES')) || {nom:EXCLUSIFS[v] || 'Cosmétique exclusif', valeur:v, prix:0});
}
function economie(pack, catalogue) {
  const articles = contenu(pack,catalogue);
  if (!articles.length || articles.some(c => c.prix <= 0)) return null;
  const total = articles.reduce((s,c) => s + Number(c.prix),0);
  return total > pack.prix ? {total, remise:total-pack.prix, pourcent:Math.round(100*(total-pack.prix)/total)} : null;
}
module.exports = {valeurs, possessions, contenu, economie};
