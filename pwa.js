(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {scope: '/'})
      .then(reg => {
        console.info('[V-TRADE PWA] service worker ready', reg.scope);
        reg.update().catch(() => {});
      })
      .catch(err => console.warn('[V-TRADE PWA] service worker unavailable:', err));
  });

  let deferredPrompt = null;
  const createInstallButton = () => {
    if (document.getElementById('vtrade-install')) return;
    const btn = document.createElement('button');
    btn.id = 'vtrade-install';
    btn.type = 'button';
    btn.textContent = 'Install App';
    btn.setAttribute('aria-label', 'Install V TRADE AI app');
    Object.assign(btn.style, {
      position:'fixed', right:'14px', bottom:'14px', zIndex:'9999',
      border:'1px solid #8050ff', borderRadius:'12px', padding:'11px 14px',
      background:'linear-gradient(135deg,#5523c9,#7136e8)', color:'#fff',
      font:'800 13px Segoe UI,Arial,sans-serif', boxShadow:'0 12px 35px #0009', cursor:'pointer'
    });
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      btn.remove();
    });
    document.body.appendChild(btn);
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    createInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('vtrade-install')?.remove();
    console.info('[V-TRADE PWA] installed');
  });
})();
