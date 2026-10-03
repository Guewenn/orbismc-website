// Copier l'adresse du serveur, toast de confirmation et barre flottante
function afficherToastCopie() {
  const toast = document.getElementById('toastCopie');
  if (!toast) return;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2600);
}

const etatsCopie = new WeakMap();
document.addEventListener('click', (e) => {
  for (const menu of document.querySelectorAll('details.menu-jeux[open], details.burger[open]')) {
    if (!menu.contains(e.target)) menu.open = false;
  }
  const bouton = e.target.closest('[data-copier], [data-copier-texte]');
  if (!bouton) return;
  const texteACopier = bouton.dataset.copierTexte
    || (bouton.parentElement && bouton.parentElement.querySelector('code') ? bouton.parentElement.querySelector('code').textContent.trim() : 'play.mcorbis.com');
  const etat = etatsCopie.get(bouton) || { enfants: [...bouton.childNodes] };
  etatsCopie.set(bouton, etat);
  const fini = (texte) => {
    clearTimeout(etat.minuterie);
    bouton.textContent = texte;
    etat.minuterie = setTimeout(() => { bouton.replaceChildren(...etat.enfants); }, 1600);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texteACopier).then(() => {
      fini('Copiée !');
      afficherToastCopie();
    }, () => fini('Sélectionne-la'));
  } else {
    const code = bouton.parentElement ? bouton.parentElement.querySelector('code') : null;
    if (code) getSelection().selectAllChildren(code);
    fini('Ctrl+C');
    afficherToastCopie();
  }
});

// Apparition fluide de la barre de jeu rapide lors du défilement
const barreRapide = document.getElementById('barreRapide');
if (barreRapide) {
  let deroulantActif = false;
  window.addEventListener('scroll', () => {
    if (!deroulantActif) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 380) {
          barreRapide.classList.add('visible');
        } else {
          barreRapide.classList.remove('visible');
        }
        deroulantActif = false;
      });
      deroulantActif = true;
    }
  }, { passive: true });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const menu of document.querySelectorAll('details.menu-jeux[open], details.burger[open]')) menu.open = false;
});

// Animation fluide de dépliage / repliage pour la FAQ
document.querySelectorAll('.faq details').forEach((details) => {
  const summary = details.querySelector('summary');
  if (!summary) return;
  let animation = null;

  summary.addEventListener('click', (e) => {
    e.preventDefault();
    if (animation) animation.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      details.open = !details.open;
      details.classList.remove('faq-animee');
      return;
    }

    if (details.open) {
      // Repliage animé
      const startHeight = details.offsetHeight;
      const endHeight = summary.offsetHeight;
      details.classList.add('faq-animee');
      animation = details.animate(
        [{ height: `${startHeight}px`, opacity: 1 }, { height: `${endHeight}px`, opacity: 0.95 }],
        { duration: 250, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      animation.onfinish = () => {
        details.open = false;

        details.classList.remove('faq-animee');
        animation = null;
      };
    } else {
      // Dépliage animé
      details.open = true;
      const endHeight = details.scrollHeight;
      const startHeight = summary.offsetHeight;
      details.classList.add('faq-animee');
      animation = details.animate(
        [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
        { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      animation.onfinish = () => {

        details.classList.remove('faq-animee');
        animation = null;
      };
    }
  });
});

// Les catégories et formulaires utilisent la navigation native : compatible avec
// Trusted Types, les redirections du serveur et les boutons précédent / suivant.
