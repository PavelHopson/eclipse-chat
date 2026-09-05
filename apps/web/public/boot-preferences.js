(() => {
  // Personal colors customize a dark base; the retired light preference is ignored.
  document.documentElement.setAttribute('data-ec-theme', 'obsidian');
  try {
    const root = document.documentElement;
    const density = localStorage.getItem('eclipse_chat_density');
    if (density === 'compact' || density === 'tactical') {
      root.setAttribute('data-density', density);
    }
    if (localStorage.getItem('eclipse_chat_focus_dim') === '0') {
      root.setAttribute('data-focus-dim', 'off');
    }
  } catch {
    // Hardened/private contexts may deny storage; defaults remain usable.
  }
})();
