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
      display: grid; place-items: center; cursor: pointer; background: linear-gradient(135deg, #959aff, #5b5ff2); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.15);
      transition: transform .16s cubic-bezier(.2,.8,.2,1), filter .16s; }
    button:hover { transform: translateY(-2px); filter: brightness(1.08); }
    button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    svg { width: 30px; height: 30px; }`);
  shadow.adoptedStyleSheets = [sheet];
  const b = document.createElement('button');
  b.title = label;
  b.setAttribute('aria-label', label);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 128 128');
  const bubble = document.createElementNS(NS, 'path');
  bubble.setAttribute('fill', '#fff');
  bubble.setAttribute('d', 'M38 26h52a17 17 0 0 1 17 17v31a17 17 0 0 1-17 17H63.5l-19.2 14.6c-2.3 1.7-5.4-.3-4.8-3.1L42.5 91H38a17 17 0 0 1-17-17V43a17 17 0 0 1 17-17z');
  const chev = document.createElementNS(NS, 'path');
  for (const [k, v] of [['d', 'M44.5 67.5 64 48l19.5 19.5'], ['fill', 'none'], ['stroke', '#6b6ff5'], ['stroke-width', '12.5'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) chev.setAttribute(k, v);
  svg.append(bubble, chev);
  b.appendChild(svg);
  b.addEventListener('click', onClick);
  shadow.appendChild(b);
  document.documentElement.appendChild(el);
}

export function hideLauncher() { el?.remove(); el = null; }
