(() => {
  try {
    const root = document.documentElement;
    const density = localStorage.getItem('eclipse_chat_density');
    if (density === 'compact' || density === 'tactical') {
      root.setAttribute('data-density', density);
    }
    if (localStorage.getItem('eclipse_chat_focus_dim') === '0') {
      root.setAttribute('data-focus-dim', 'off');
    }
    const theme = localStorage.getItem('eclipse-chat-theme');
    root.setAttribute('data-ec-theme', theme === 'solar' ? 'solar' : 'obsidian');
  } catch {
    // Hardened/private contexts may deny storage; defaults remain usable.
  }
})();
