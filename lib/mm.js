// Rendu HTML des cosmétiques (format MiniMessage du plugin) sans aucun style en ligne, pour rester
// compatible avec la politique de sécurité du site : chaque cosmétique a sa classe .mm-<id>,
// définie dans /css/cosmetiques.css (généré depuis le catalogue).
const { esc } = require('./html');

function texte(valeur, pseudo = '') {
  return String(valeur || '').replace('{n}', pseudo).replace(/<[^>]+>/g, '');
}

function span(id, valeur, pseudo = '') {
  if (!id) return esc(pseudo);
  return `<span class="mm mm-${esc(id)}">${esc(texte(valeur, pseudo))}</span>`;
}

// Feuille de style : une règle par cosmétique.
function css(catalogue) {
  const regles = ['@keyframes mm-defile{from{background-position:0% 50%}to{background-position:200% 50%}}',
    '@media (prefers-reduced-motion:reduce){.mm{animation:none!important}}'];
  for (const c of catalogue) {
    if (!/^[a-z0-9_]+$/.test(c.id)) continue;
    // « {p} » = dégradé animé en jeu : on le fait défiler ici aussi.
    const degrade = String(c.valeur).match(/^<gradient:((?:#[0-9a-fA-F]{6}:?)+)(\{p\})?>/);
    const simple = String(c.valeur).match(/^<(#[0-9a-fA-F]{6})>/);
    if (degrade) {
      const couleurs = degrade[1].split(':').filter(Boolean).join(',');
      const anime = degrade[2] ? ';background-size:200% auto;animation:mm-defile 3s linear infinite' : '';
      regles.push(`.mm-${c.id}{background:linear-gradient(90deg,${couleurs});-webkit-background-clip:text;background-clip:text;color:transparent${anime}}`);
    } else if (simple) {
      regles.push(`.mm-${c.id}{color:${simple[1]}}`);
    }
  }
  return regles.join('\n');
}

module.exports = { span, texte, css };
