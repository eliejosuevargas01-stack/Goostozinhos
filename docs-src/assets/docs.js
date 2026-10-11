// Menu mobile, copiar código, TOC ativo, diagramas.
const side = document.getElementById('side');
const menu = document.querySelector('.menu');
menu?.addEventListener('click', () => {
  const open = side.classList.toggle('open');
  menu.setAttribute('aria-expanded', open);
});
document.querySelector('.main')?.addEventListener('click', () => { if (side.classList.contains('open')) { side.classList.remove('open'); menu.setAttribute('aria-expanded', false); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && side.classList.contains('open')) { side.classList.remove('open'); menu.setAttribute('aria-expanded', false); menu.focus(); }
});

document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
  const text = b.closest('.code').querySelector('code').innerText;
  try { await navigator.clipboard.writeText(text); b.textContent = 'Copiado'; }
  catch { b.textContent = 'Selecione e copie'; }
  setTimeout(() => (b.textContent = 'Copiar'), 2000);
}));

const links = [...document.querySelectorAll('.toc a')];
if (links.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.hash === '#' + en.target.id));
  }), { rootMargin: '-70px 0px -70% 0px' });
  document.querySelectorAll('.doc h2[id], .doc h3[id]').forEach(h => io.observe(h));
}

window.addEventListener('load', () => {
  if (!window.mermaid) return;
  mermaid.initialize({
    startOnLoad: false, theme: 'base', securityLevel: 'strict',
    themeVariables: {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px',
      primaryColor: '#F5F0FF', primaryBorderColor: '#7C3AED', primaryTextColor: '#0F172A',
      lineColor: '#9CA3AF', secondaryColor: '#ECFDF5', tertiaryColor: '#FFFFFF',
      edgeLabelBackground: '#FFFFFF', clusterBkg: '#F9FAFB'
    },
    flowchart: { useMaxWidth: false, nodeSpacing: 36, rankSpacing: 44 }, state: { useMaxWidth: false }
  });
  // ponytail: escala mínima 0,8 mantém o texto legível; card rola na horizontal acima disso.
  mermaid.run({ querySelector: 'pre.mermaid' }).then(() => document.querySelectorAll('.diagram svg').forEach(s => {
    const w = +s.getAttribute('viewBox').split(' ')[2], cw = s.closest('.diagram').clientWidth - 48;
    s.style.width = Math.max(Math.min(w, cw), w * 0.8) + 'px';
  }));
});
