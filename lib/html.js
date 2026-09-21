// Échappement : tout ce qui vient de la base ou du visiteur passe par esc() avant d'entrer dans le HTML.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function nombre(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

function duree(ms) {
  const minutes = Math.floor(Number(ms || 0) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${nombre(h)} h ${String(minutes % 60).padStart(2, '0')}`;
}

function date(ms) {
  return new Date(Number(ms)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

module.exports = { esc, nombre, duree, date };
