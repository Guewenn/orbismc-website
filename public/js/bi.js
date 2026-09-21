// Scripts d'interactivité pour le Dashboard BI OrbisMC
// 100% conforme Content-Security-Policy (aucun innerHTML, aucune injection non fiable)

document.addEventListener('DOMContentLoaded', () => {
  // Navigation par onglets principaux (Vue d'ensemble / Fonctionnalités / Documentation)
  function activerOnglet(cibleId) {
    const boutons = document.querySelectorAll('[data-bi-tab]');
    const vues = document.querySelectorAll('.bi-view');

    boutons.forEach((btn) => {
      const actif = btn.getAttribute('data-bi-tab') === cibleId;
      btn.classList.toggle('active', actif);
    });

    vues.forEach((vue) => {
      const actif = vue.id === cibleId;
      vue.classList.toggle('active', actif);
    });
  }

  // Clic sur les onglets principaux
  document.addEventListener('click', (e) => {
    const btnTab = e.target.closest('[data-bi-tab]');
    if (btnTab) {
      e.preventDefault();
      const cibleId = btnTab.getAttribute('data-bi-tab');
      activerOnglet(cibleId);
      if (history.pushState) {
        history.pushState(null, '', '#' + cibleId.replace('tab-', ''));
      }
      return;
    }

    // Sous-onglets de métriques (Ventes par mois, Réachats, etc.)
    const btnSubtab = e.target.closest('[data-bi-subtab]');
    if (btnSubtab) {
      e.preventDefault();
      document.querySelectorAll('[data-bi-subtab]').forEach((b) => b.classList.remove('active'));
      btnSubtab.classList.add('active');
      return;
    }

    // Pilules de segmentation (Par Pays, Par Sous-domaine, etc.)
    const btnPill = e.target.closest('[data-bi-pill]');
    if (btnPill) {
      e.preventDefault();
      document.querySelectorAll('[data-bi-pill]').forEach((p) => p.classList.remove('active'));
      btnPill.classList.add('active');
      return;
    }

    // Bouton appliquer les filtres (sidebar)
    const btnFiltrer = e.target.closest('.bi-btn-filter');
    if (btnFiltrer) {
      e.preventDefault();
      const txtAvant = btnFiltrer.textContent;
      btnFiltrer.textContent = 'Actualisation…';
      setTimeout(() => {
        btnFiltrer.textContent = 'Filtres appliqués ✔';
        setTimeout(() => {
          btnFiltrer.textContent = txtAvant;
        }, 1200);
      }, 350);
      return;
    }

    // Bouton réinitialiser les filtres (sidebar)
    const btnReset = e.target.closest('.bi-btn-clear');
    if (btnReset) {
      e.preventDefault();
      document.querySelectorAll('[data-bi-subtab]').forEach((b, i) => b.classList.toggle('active', i === 2));
      document.querySelectorAll('[data-bi-pill]').forEach((p, i) => p.classList.toggle('active', i === 1));
      return;
    }
  });

  // Support du lien direct par ancre hash (#features, #docs)
  const hash = window.location.hash.replace('#', '');
  if (hash === 'features' || hash === 'fonctionnalites') {
    activerOnglet('tab-features');
  } else if (hash === 'docs' || hash === 'documentation') {
    activerOnglet('tab-docs');
  } else {
    activerOnglet('tab-overview');
  }
});
