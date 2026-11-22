/** A small Orbit button on pages Orbit leaves native (or in classic mode), to hop back. Shared by every platform. */
let el: HTMLElement | null = null;

export function showLauncher(label: string, onClick: () => void) {
  if (el) { el.shadowRoot!.querySelector('button')!.setAttribute('aria-label', label); el.shadowRoot!.querySelector('button')!.title = label; return; }
  el = document.createElement('div');
  el.id = 'orbit-launcher';
  for (const [k, v] of [['display', 'block'], ['visibility', 'visible'], ['opacity', '1']]) el.style.setProperty(k, v, 'important');
  const shadow = el.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    button { all: unset; box-sizing: border-box; position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; width: 42px; height: 42px; border-radius: 12px;
      display: grid; place-items: center; cursor: pointer; background: linear-gradient(135deg, #959aff, #5b5ff2); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.15);
      transition: transform .16s cubic-bezier(.2,.8,.2,1), filter .16s; }
    button:hover { transform: translateY(-2px); filter: brightness(1.08); }
    button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    svg { width: 26px; height: 26px; }`);
  shadow.adoptedStyleSheets = [sheet];
  const b = document.createElement('button');
  b.title = label;
  b.setAttribute('aria-label', label);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 128 128');
  const ring = document.createElementNS(NS, 'circle');
  for (const [k, v] of [['cx', '58'], ['cy', '70'], ['r', '28'], ['fill', 'none'], ['stroke', '#fff'], ['stroke-width', '13']]) ring.setAttribute(k, v);
  const moon = document.createElementNS(NS, 'circle');
  for (const [k, v] of [['cx', '96'], ['cy', '32'], ['r', '12'], ['fill', '#fff']]) moon.setAttribute(k, v);
  svg.append(ring, moon);
  b.appendChild(svg);
  b.addEventListener('click', onClick);
  shadow.appendChild(b);
  document.documentElement.appendChild(el);
}

export function hideLauncher() { el?.remove(); el = null; }
