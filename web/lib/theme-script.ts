// Blocking inline script that runs before first paint to prevent FOUC.
// Exported as a string for dangerouslySetInnerHTML in <head>.
export const themeScript = `(function(){
  try {
    var stored = localStorage.getItem('flyfast-theme') || 'system';
    var resolved = stored;
    if (stored === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.remove('light','dark');
    document.documentElement.classList.add(resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#070b14' : '#7ab8f5');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();`;
