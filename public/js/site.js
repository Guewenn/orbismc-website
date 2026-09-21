// Copier l'adresse du serveur et fermer les menus déroulants. Rien d'autre : aucun élément n'est masqué ni animé par script.
document.addEventListener('click', (e) => {
  for (const menu of document.querySelectorAll('details.menu-jeux[open], details.burger[open]')) {
    if (!menu.contains(e.target)) menu.open = false;
  }
  const bouton = e.target.closest('[data-copier]');
  if (!bouton) return;
  const code = bouton.parentElement.querySelector('code');
  if (!code) return;
  const avant = bouton.textContent;
  const fini = (texte) => {
    bouton.textContent = texte;
    setTimeout(() => { bouton.textContent = avant; }, 1600);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code.textContent.trim()).then(() => fini('Copiée !'), () => fini('Sélectionne-la'));
  } else {
    // Hors https, le presse-papiers est refusé : on sélectionne l'adresse pour un Ctrl+C.
    getSelection().selectAllChildren(code);
    fini('Ctrl+C');
  }
});

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

    if (details.open) {
      // Repliage animé
      const startHeight = details.offsetHeight;
      const endHeight = summary.offsetHeight;
      details.style.overflow = 'hidden';
      animation = details.animate(
        [{ height: `${startHeight}px`, opacity: 1 }, { height: `${endHeight}px`, opacity: 0.95 }],
        { duration: 250, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      animation.onfinish = () => {
        details.open = false;
        details.style.height = '';
        details.style.overflow = '';
        animation = null;
      };
    } else {
      // Dépliage animé
      details.open = true;
      const endHeight = details.scrollHeight;
      const startHeight = summary.offsetHeight;
      details.style.overflow = 'hidden';
      animation = details.animate(
        [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
        { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      animation.onfinish = () => {
        details.style.height = '';
        details.style.overflow = '';
        animation = null;
      };
    }
  });
});

// Changement d'onglet fluide pour les cosmétiques du compte sans rechargement ni saut de page
document.addEventListener('click', (e) => {
  const a = e.target.closest('#cosmetiques .onglets-cosm a');
  if (!a || !a.href) return;
  e.preventDefault();
  const url = a.href;
  fetch(url)
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nouveau = doc.querySelector('#cosmetiques');
      const actuel = document.querySelector('#cosmetiques');
      if (nouveau && actuel) {
        actuel.innerHTML = nouveau.innerHTML;
        history.pushState(null, '', url);
      } else {
        window.location.href = url;
      }
    })
    .catch(() => {
      window.location.href = url;
    });
});

// Équiper un cosmétique sans recharger la page
document.addEventListener('submit', (e) => {
  const form = e.target.closest('#cosmetiques form[action="/compte/equiper"]');
  if (!form) return;
  e.preventDefault();
  const donnees = new URLSearchParams(new FormData(form));
  fetch(form.action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: donnees.toString(),
  })
    .then((res) => fetch(res.url || window.location.href))
    .then((res) => res.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nouveau = doc.querySelector('#cosmetiques');
      const actuel = document.querySelector('#cosmetiques');
      if (nouveau && actuel) actuel.innerHTML = nouveau.innerHTML;
    })
    .catch(() => {
      form.submit();
    });
});

window.addEventListener('popstate', () => {
  if (location.pathname === '/compte' && document.querySelector('#cosmetiques')) {
    fetch(location.href)
      .then((r) => r.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const nouveau = doc.querySelector('#cosmetiques');
        const actuel = document.querySelector('#cosmetiques');
        if (nouveau && actuel) actuel.innerHTML = nouveau.innerHTML;
      })
      .catch(() => {});
  }
});
