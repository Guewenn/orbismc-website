// Vercel : 0 ignore, 1 construit. Comparer avec le dernier déploiement réussi,
// pas seulement HEAD^ (plusieurs commits peuvent arriver entre deux publications).
const { spawnSync } = require('node:child_process');
const precedent = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (process.env.VERCEL_ENV === 'preview') {
  console.log('Aperçus automatiques ignorés pour préserver le quota.');
  process.exit(0);
}
if (!precedent || !/^[a-f0-9]{40}$/i.test(precedent)) process.exit(1);
const comparaison = spawnSync('git', ['diff', '--quiet', precedent, 'HEAD', '--', '.'], { cwd: require('node:path').join(__dirname, '..') });
// Référence absente d'un clone peu profond : publier plutôt que rater une mise à jour.
process.exit(comparaison.status === 0 ? 0 : 1);
