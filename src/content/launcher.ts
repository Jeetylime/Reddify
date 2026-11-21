/** A small button on pages Reddify leaves native (settings, submit, chat…) or in classic mode, to hop back. */
let el: HTMLElement | null = null;

export function showLauncher(label: string, onClick: () => void) {
  if (el) { el.shadowRoot!.querySelector('button')!.setAttribute('aria-label', label); el.shadowRoot!.querySelector('button')!.title = label; return; }
  el = document.createElement('div');
  el.id = 'reddify-launcher';
  for (const [k, v] of [['display', 'block'], ['visibility', 'visible'], ['opacity', '1']]) el.style.setProperty(k, v, 'important');
  const shadow = el.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    button { all: unset; box-sizing: border-box; position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; width: 42px; height: 42px; border-radius: 12px;
      display: grid; place-items: center; cursor: pointer; background: #7c83ff; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.15);
      transition: transform .16s cubic-bezier(.2,.8,.2,1), filter .16s; }
    button:hover { transform: translateY(-2px); filter: brightness(1.08); }
    button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    svg { width: 24px; height: 24px; }`);
  shadow.adoptedStyleSheets = [sheet];
  const b = document.createElement('button');
  b.title = label;
  b.setAttribute('aria-label', label);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', '#fff');
  path.setAttribute('d', 'M10.5 23V9h6.4c3 0 4.9 1.7 4.9 4.3 0 1.9-1.1 3.3-2.9 3.9L22.4 23h-3.6l-3.2-5.5h-1.8V23zm3.3-8.3h2.9c1.2 0 1.9-.6 1.9-1.5s-.7-1.5-1.9-1.5h-2.9z');
  svg.appendChild(path);
  b.appendChild(svg);
  b.addEventListener('click', onClick);
  shadow.appendChild(b);
  document.documentElement.appendChild(el);
}

export function hideLauncher() { el?.remove(); el = null; }
