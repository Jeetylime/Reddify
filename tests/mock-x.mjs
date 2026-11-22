// A deterministic fake x.com / twitter.com for end-to-end tests.
//
// Every non-asset HTML request returns the same single-page app (plain inline JS, no framework)
// that renders by `location.pathname` and handles navigation itself, imitating the DOM of the
// current X web client ("x-web": React + Tailwind, no data-testid attributes). pbs.twimg.com
// images are generated SVGs. Write actions (likes, posts, follows…) POST to /i/api/mock/<type>
// and are pushed into the `log` array given to installMockX().

const PROFILE_SIZES = { mini: 24, normal: 48, bigger: 73, x96: 96, reasonably_small: 128, '200x200': 200, '400x400': 400 };

function hashStr(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Generated SVG for any pbs.twimg.com URL. Media honour `w`/`h` query params so aspect ratios are real. */
export function svgImage(url) {
  const u = new URL(url);
  const p = u.pathname;
  if (p.startsWith('/profile_images/')) {
    const file = p.split('/').pop() || 'x';
    const m = /^(.*?)(?:_(mini|normal|bigger|x96|reasonably_small|200x200|400x400))?(?:\.\w+)?$/.exec(file);
    const base = (m && m[1]) || 'x';
    const size = PROFILE_SIZES[m && m[2]] || 400;
    const letter = base === 'me' ? 'O' : (base.replace(/[^A-Za-z0-9]/g, '')[0] || 'X').toUpperCase();
    const hue = hashStr(base) % 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="hsl(${hue},58%,46%)"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="46" font-weight="700" fill="#fff">${letter}</text></svg>`;
  }
  const banner = p.startsWith('/profile_banners/');
  const w = Number(u.searchParams.get('w')) || (banner ? 1500 : 1200);
  const h = Number(u.searchParams.get('h')) || (banner ? 500 : 675);
  const hue = hashStr(p) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},62%,60%)"/><stop offset=".55" stop-color="hsl(${(hue + 35) % 360},48%,40%)"/><stop offset="1" stop-color="hsl(${(hue + 70) % 360},42%,18%)"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#a)"/>
    <circle cx="${w * 0.7}" cy="${h * 0.32}" r="${Math.min(w, h) * 0.1}" fill="hsla(${(hue + 180) % 360},90%,86%,.85)"/>
    <path d="M0 ${h * 0.78} L${w * 0.24} ${h * 0.52} L${w * 0.4} ${h * 0.66} L${w * 0.62} ${h * 0.44} L${w} ${h * 0.72} L${w} ${h} L0 ${h}Z" fill="hsla(${(hue + 40) % 360},35%,14%,.7)"/>
  </svg>`;
}

// Semantic tokens copied from X's real stylesheet (same selectors/values; colour ramps trimmed to the
// steps the semantic tokens reference).
const TOKENS_CSS = `:root{--x-black:#000;--x-white:#fff;--x-neutral-000:#f2f2f2;--x-neutral-050:#ebebeb;--x-neutral-100:#d9d9d9;--x-neutral-200:#ccc;--x-neutral-300:#b2b2b2;--x-neutral-400:#999;--x-neutral-500:gray;--x-neutral-600:#666;--x-neutral-700:#4d4d4d;--x-neutral-800:#333;--x-neutral-900:#262626;--x-neutral-1000:#141414;--x-neutral-1100:#0d0d0d;--x-black-00:#0000;--x-black-01:#00000003;--x-black-02:#00000005;--x-black-03:#00000008;--x-black-04:#0000000a;--x-black-05:#0000000d;--x-black-06:#0000000f;--x-black-07:#00000012;--x-black-08:#00000014;--x-black-09:#00000017;--x-black-10:#0000001a;--x-black-15:#00000026;--x-black-20:#0003;--x-black-30:#0000004d;--x-black-40:#0006;--x-black-50:#00000080;--x-black-60:#0009;--x-black-70:#000000b3;--x-black-80:#000c;--x-black-85:#000000d9;--x-black-90:#000000e6;--x-black-95:#000000f2;--x-white-00:#fff0;--x-white-01:#ffffff03;--x-white-02:#ffffff05;--x-white-03:#ffffff08;--x-white-04:#ffffff0a;--x-white-05:#ffffff0d;--x-white-06:#ffffff0f;--x-white-07:#ffffff12;--x-white-08:#ffffff14;--x-white-09:#ffffff17;--x-white-10:#ffffff1a;--x-white-15:#ffffff26;--x-white-20:#fff3;--x-white-30:#ffffff4d;--x-white-40:#fff6;--x-white-50:#ffffff80;--x-white-60:#fff9;--x-white-70:#ffffffb3;--x-white-80:#fffc;--x-white-85:#ffffffd9;--x-white-90:#ffffffe6;--x-white-95:#fffffff2;--x-radius-m:1;--x-font-scale:1;--x-font-sans:TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif}
:root,[data-theme=light]{--x-blue-000:#eafaff;--x-blue-050:#d7f6ff;--x-blue-100:#bff2ff;--x-blue-500:#1d9bf0;--x-blue-600:#0083eb;--x-blue-700:#006fd6;--x-green-000:#edfff9;--x-green-050:#dbf8eb;--x-green-100:#c2f1dc;--x-green-500:#00ba7c;--x-green-600:#009c64;--x-green-700:#007e50;--x-red-000:#fff0f1;--x-red-050:#fedee3;--x-red-100:#fdc9ce;--x-red-500:#f4212e;--x-red-600:#d11a28;--x-red-700:#ae1425;--x-orange-000:#fef5ec;--x-orange-050:#ffeddb;--x-orange-100:#ffe0c2;--x-orange-500:#ff7a00;--x-orange-600:#d86000;--x-orange-700:#b04500;--x-yellow-000:#fffdea;--x-yellow-050:#fffed7;--x-yellow-100:#fffec0;--x-yellow-500:#ffd400;--x-yellow-600:#dcab00;--x-yellow-700:#b88200;--x-purple-000:#f5f3ff;--x-purple-050:#ece8ff;--x-purple-100:#dfd8ff;--x-purple-500:#7856ff;--x-purple-600:#6545db;--x-purple-700:#5234b7;--x-plum-000:#ffefff;--x-plum-050:#fae0fa;--x-plum-100:#f4cdf5;--x-plum-500:#c936cc;--x-plum-600:#ab2bae;--x-plum-700:#8d2090;--x-magenta-000:#fff1f8;--x-magenta-050:#ffdded;--x-magenta-100:#fec7e1;--x-magenta-500:#f91880;--x-magenta-600:#d4136d;--x-magenta-700:#af0e5a;--x-teal-000:#e9feff;--x-teal-050:#d1f8fa;--x-teal-100:#b3f1f4;--x-teal-500:#00afb6;--x-teal-600:#009399;--x-teal-700:#00777c;color-scheme:light;--x-bg-primary:var(--x-white);--x-bg-secondary:var(--x-neutral-000);--x-bg-tertiary:var(--x-neutral-050);--x-bg-quaternary:var(--x-black-04);--x-bg-sheets:var(--x-white);--x-bg-inputs:var(--x-black-04);--x-bg-modal:var(--x-white);--x-bg-transparent:transparent;--x-bg-destructive:var(--x-red-050);--x-bg-success:var(--x-green-000);--x-bg-info:var(--x-blue-000);--x-bg-warning:var(--x-yellow-000);--x-bg-subscribe:var(--x-plum-050);--x-fg-primary:var(--x-black);--x-fg-secondary:var(--x-neutral-600);--x-fg-tertiary:var(--x-neutral-300);--x-fg-inverted:var(--x-white);--x-fg-on-color:var(--x-white);--x-fg-on-brand:var(--x-fg-on-color);--x-fg-brand:var(--x-blue-500);--x-brand-subtle:color-mix(in srgb, var(--x-fg-brand) 10%, var(--x-bg-primary));--x-brand-wash:color-mix(in srgb, var(--x-fg-brand) 58%, transparent);--x-fg-destructive:var(--x-red-500);--x-fg-success:var(--x-green-500);--x-fg-warning:var(--x-yellow-500);--x-fg-subscribe:var(--x-plum-500);--x-border-normal:var(--x-black-15);--x-border-divider:var(--x-black-06);--x-border-hover:var(--x-black-20);--x-border-active:var(--x-black-30);--x-border-media:var(--x-black-04);--x-border-elevated:#fff3;--x-border-destructive:var(--x-red-500);--x-border-destructive-light:var(--x-red-100);--x-btn-primary:var(--x-black);--x-btn-primary-hover:var(--x-black-80);--x-btn-primary-pressed:var(--x-black-70);--x-btn-secondary:var(--x-neutral-050);--x-btn-secondary-hover:var(--x-neutral-100);--x-btn-secondary-pressed:var(--x-neutral-200);--x-btn-tertiary:var(--x-black-04);--x-btn-tertiary-hover:var(--x-black-08);--x-btn-tertiary-pressed:var(--x-black-15);--x-btn-tertiary-opaque:color-mix(in srgb, var(--x-black) 4%, var(--x-bg-primary));--x-btn-tertiary-opaque-hover:color-mix(in srgb, var(--x-black) 8%, var(--x-bg-primary));--x-btn-tertiary-opaque-pressed:color-mix(in srgb, var(--x-black) 15%, var(--x-bg-primary));--x-btn-ghost-hover:var(--x-black-04);--x-btn-ghost-pressed:var(--x-black-15);--x-btn-inverted:var(--x-white);--x-btn-inverted-hover:var(--x-white-90);--x-btn-inverted-pressed:var(--x-white-80);--x-btn-brand:var(--x-blue-500);--x-btn-brand-hover:var(--x-blue-600);--x-btn-brand-pressed:var(--x-blue-700);--x-btn-destructive:var(--x-red-500);--x-btn-destructive-hover:var(--x-red-600);--x-btn-destructive-pressed:var(--x-red-700);--x-hover-subtle:var(--x-black-04);--x-hover-faint:var(--x-black-03);--x-skeleton-shimmer:var(--x-white-70);--x-overlay-normal:var(--x-black-20);--x-overlay-strong:var(--x-black-40);--x-toast-bg:#2229;--x-tooltip-bg:var(--x-neutral-800);--x-tooltip-fg:var(--x-white);--x-segmented-control-thumb:var(--x-white);--x-shadow-sm:0 1px 2px #0000000d;--x-shadow-md:0 4px 12px #00000014;--x-shadow-lg:0 8px 24px #0000001f;--x-shadow-toast:0 8px 32px #0003;--x-shadow-popup:0 4px 20px #00000014;--x-ring:var(--x-fg-primary);--x-shadow-focus:0 0 0 2px color-mix(in srgb, var(--x-ring) 75%, transparent);--x-shadow-focus-destructive:0 0 0 2px color-mix(in srgb, var(--x-border-destructive) 80%, transparent);--x-fg-alpha-00:#0000;--x-fg-alpha-01:#00000003;--x-fg-alpha-02:#00000005;--x-fg-alpha-03:#00000008;--x-fg-alpha-04:#0000000a;--x-fg-alpha-05:#0000000d;--x-fg-alpha-06:#0000000f;--x-fg-alpha-07:#00000012;--x-fg-alpha-08:#00000014;--x-fg-alpha-09:#00000017;--x-fg-alpha-10:#0000001a;--x-fg-alpha-15:#00000026;--x-fg-alpha-20:#0003;--x-fg-alpha-30:#0000004d;--x-fg-alpha-40:#0006;--x-fg-alpha-50:#00000080;--x-fg-alpha-60:#0009;--x-fg-alpha-70:#000000b3;--x-fg-alpha-80:#000c;--x-fg-alpha-85:#000000d9;--x-fg-alpha-90:#000000e6;--x-fg-alpha-95:#000000f2;--x-fg-alpha-100:#000;--x-bg-alpha-00:#fff0;--x-bg-alpha-01:#ffffff03;--x-bg-alpha-02:#ffffff05;--x-bg-alpha-03:#ffffff08;--x-bg-alpha-04:#ffffff0a;--x-bg-alpha-05:#ffffff0d;--x-bg-alpha-06:#ffffff0f;--x-bg-alpha-07:#ffffff12;--x-bg-alpha-08:#ffffff14;--x-bg-alpha-09:#ffffff17;--x-bg-alpha-10:#ffffff1a;--x-bg-alpha-15:#ffffff26;--x-bg-alpha-20:#fff3;--x-bg-alpha-30:#ffffff4d;--x-bg-alpha-40:#fff6;--x-bg-alpha-50:#ffffff80;--x-bg-alpha-60:#fff9;--x-bg-alpha-70:#ffffffb3;--x-bg-alpha-80:#fffc;--x-bg-alpha-85:#ffffffd9;--x-bg-alpha-90:#ffffffe6;--x-bg-alpha-95:#fffffff2;--x-bg-alpha-100:#fff}
[data-theme=dark]{--x-blue-000:#02113d;--x-blue-050:#00154a;--x-blue-100:#003886;--x-blue-500:#1d9bf0;--x-blue-600:#43b3f6;--x-blue-700:#6bc9fb;--x-green-000:#002218;--x-green-050:#00251a;--x-green-100:#004329;--x-green-500:#00ba7c;--x-green-600:#31c88e;--x-green-700:#61d6a3;--x-red-000:#3d0105;--x-red-050:#440004;--x-red-100:#67070f;--x-red-500:#f4212e;--x-red-600:#f64b5c;--x-red-700:#f87580;--x-orange-000:#3c1201;--x-orange-050:#491600;--x-orange-100:#692100;--x-orange-500:#ff7a00;--x-orange-600:#ff9331;--x-orange-700:#ffad61;--x-yellow-000:#3d1e02;--x-yellow-050:#482300;--x-yellow-100:#6f3e00;--x-yellow-500:#ffd400;--x-yellow-600:#ffe042;--x-yellow-700:#ffeb6b;--x-purple-000:#160634;--x-purple-050:#19004a;--x-purple-100:#2c116e;--x-purple-500:#7856ff;--x-purple-600:#9276ff;--x-purple-700:#ac97ff;--x-plum-000:#2d032d;--x-plum-050:#340035;--x-plum-100:#520b53;--x-plum-500:#c936cc;--x-plum-600:#d45cd6;--x-plum-700:#df82e0;--x-magenta-000:#37011c;--x-magenta-050:#3f001f;--x-magenta-100:#640533;--x-magenta-500:#f91880;--x-magenta-600:#fa4498;--x-magenta-700:#fb70b0;--x-teal-000:#022023;--x-teal-050:#002225;--x-teal-100:#003e42;--x-teal-500:#00afb6;--x-teal-600:#00c9d1;--x-teal-700:#3cd6dd;color-scheme:dark;--x-bg-primary:var(--x-black);--x-bg-secondary:var(--x-neutral-1000);--x-bg-tertiary:var(--x-neutral-900);--x-bg-quaternary:var(--x-white-04);--x-bg-modal:var(--x-neutral-1000);--x-bg-sheets:var(--x-neutral-1000);--x-bg-inputs:var(--x-white-08);--x-bg-transparent:transparent;--x-bg-destructive:var(--x-red-050);--x-bg-success:var(--x-green-000);--x-bg-info:var(--x-blue-000);--x-bg-warning:var(--x-yellow-000);--x-bg-subscribe:var(--x-plum-050);--x-fg-primary:var(--x-white);--x-fg-secondary:var(--x-neutral-400);--x-fg-tertiary:var(--x-neutral-700);--x-fg-inverted:var(--x-black);--x-fg-on-color:var(--x-white);--x-fg-on-brand:var(--x-fg-on-color);--x-fg-brand:var(--x-blue-500);--x-brand-subtle:color-mix(in srgb, var(--x-fg-brand) 14%, var(--x-bg-primary));--x-brand-wash:color-mix(in srgb, var(--x-fg-brand) 58%, transparent);--x-fg-destructive:var(--x-red-500);--x-fg-success:var(--x-green-500);--x-fg-warning:var(--x-yellow-500);--x-fg-subscribe:var(--x-plum-500);--x-border-normal:var(--x-white-15);--x-border-divider:var(--x-white-20);--x-border-hover:var(--x-white-20);--x-border-active:var(--x-white-30);--x-border-media:var(--x-white-04);--x-border-elevated:#fff3;--x-border-destructive:var(--x-red-500);--x-border-destructive-light:var(--x-red-100);--x-btn-primary:var(--x-white);--x-btn-primary-hover:var(--x-white-80);--x-btn-primary-pressed:var(--x-white-70);--x-btn-secondary:var(--x-neutral-900);--x-btn-secondary-hover:var(--x-neutral-800);--x-btn-secondary-pressed:var(--x-neutral-700);--x-btn-tertiary:var(--x-white-10);--x-btn-tertiary-hover:var(--x-white-15);--x-btn-tertiary-pressed:var(--x-white-20);--x-btn-tertiary-opaque:color-mix(in srgb, var(--x-white) 10%, var(--x-bg-primary));--x-btn-tertiary-opaque-hover:color-mix(in srgb, var(--x-white) 15%, var(--x-bg-primary));--x-btn-tertiary-opaque-pressed:color-mix(in srgb, var(--x-white) 20%, var(--x-bg-primary));--x-btn-ghost-hover:var(--x-white-08);--x-btn-ghost-pressed:var(--x-white-15);--x-btn-inverted:var(--x-black);--x-btn-inverted-hover:var(--x-black-90);--x-btn-inverted-pressed:var(--x-black-80);--x-btn-brand:var(--x-blue-500);--x-btn-brand-hover:var(--x-blue-600);--x-btn-brand-pressed:var(--x-blue-700);--x-btn-destructive:var(--x-red-500);--x-btn-destructive-hover:var(--x-red-600);--x-btn-destructive-pressed:var(--x-red-700);--x-hover-subtle:var(--x-white-08);--x-hover-faint:var(--x-white-03);--x-skeleton-shimmer:var(--x-white-06);--x-overlay-normal:var(--x-black-40);--x-overlay-strong:var(--x-black-80);--x-toast-bg:#2229;--x-tooltip-bg:var(--x-neutral-300);--x-tooltip-fg:var(--x-black);--x-segmented-control-thumb:var(--x-white-15);--x-shadow-sm:0 1px 2px #0000001a;--x-shadow-md:0 4px 12px #00000026;--x-shadow-lg:0 8px 24px #0003;--x-shadow-toast:0 8px 32px #00000059;--x-shadow-popup:0 4px 20px #0006;--x-ring:var(--x-fg-primary);--x-shadow-focus:0 0 0 2px color-mix(in srgb, var(--x-ring) 75%, transparent);--x-shadow-focus-destructive:0 0 0 2px color-mix(in srgb, var(--x-border-destructive) 80%, transparent);--x-fg-alpha-00:#fff0;--x-fg-alpha-01:#ffffff03;--x-fg-alpha-02:#ffffff05;--x-fg-alpha-03:#ffffff08;--x-fg-alpha-04:#ffffff0a;--x-fg-alpha-05:#ffffff0d;--x-fg-alpha-06:#ffffff0f;--x-fg-alpha-07:#ffffff12;--x-fg-alpha-08:#ffffff14;--x-fg-alpha-09:#ffffff17;--x-fg-alpha-10:#ffffff1a;--x-fg-alpha-15:#ffffff26;--x-fg-alpha-20:#fff3;--x-fg-alpha-30:#ffffff4d;--x-fg-alpha-40:#fff6;--x-fg-alpha-50:#ffffff80;--x-fg-alpha-60:#fff9;--x-fg-alpha-70:#ffffffb3;--x-fg-alpha-80:#fffc;--x-fg-alpha-85:#ffffffd9;--x-fg-alpha-90:#ffffffe6;--x-fg-alpha-95:#fffffff2;--x-fg-alpha-100:#fff;--x-bg-alpha-00:#0000;--x-bg-alpha-01:#00000003;--x-bg-alpha-02:#00000005;--x-bg-alpha-03:#00000008;--x-bg-alpha-04:#0000000a;--x-bg-alpha-05:#0000000d;--x-bg-alpha-06:#0000000f;--x-bg-alpha-07:#00000012;--x-bg-alpha-08:#00000014;--x-bg-alpha-09:#00000017;--x-bg-alpha-10:#0000001a;--x-bg-alpha-15:#00000026;--x-bg-alpha-20:#0003;--x-bg-alpha-30:#0000004d;--x-bg-alpha-40:#0006;--x-bg-alpha-50:#00000080;--x-bg-alpha-60:#0009;--x-bg-alpha-70:#000000b3;--x-bg-alpha-80:#000c;--x-bg-alpha-85:#000000d9;--x-bg-alpha-90:#000000e6;--x-bg-alpha-95:#000000f2;--x-bg-alpha-100:#000}`;

const APP_CSS = String.raw`
:root{--safe-area-top:0px;--safe-area-bottom:0px;--x-page-height:100dvh;--spacing-horizontal:16px;--spacing-vertical:12px;--radius-md:calc(16px * var(--x-radius-m))}
*,:after,:before{box-sizing:border-box;margin:0;padding:0;border:0 solid}
html{-webkit-text-size-adjust:100%;background-color:var(--x-bg-primary);color:var(--x-fg-primary)}
body{font-family:var(--x-font-sans);background-color:var(--x-bg-primary);color:var(--x-fg-primary);font-size:15px;line-height:20px;min-height:100dvh;-webkit-font-smoothing:antialiased;overflow-y:scroll}
a{color:inherit;text-decoration:inherit}
button,input{font:inherit;color:inherit;background-color:transparent;letter-spacing:inherit;text-align:inherit}
button{cursor:pointer}button:disabled{cursor:default}
input::placeholder{color:var(--x-fg-secondary);opacity:1}
input[type=search]::-webkit-search-cancel-button{display:none}
img,svg,video{display:block}img,video{max-width:100%}
ul{list-style:none}h1,h2,h3{font-size:inherit;font-weight:inherit}
[hidden]{display:none!important}
:focus-visible{outline:2px solid var(--x-fg-brand);outline-offset:2px}
[contenteditable]:focus,input:focus{outline:none}

.hidden{display:none}.block{display:block}.inline{display:inline}.inline-block{display:inline-block}.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}.contents{display:contents}
.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}.grow{flex-grow:1}.shrink-0{flex-shrink:0}.shrink{flex-shrink:1}.min-w-0{min-width:0}.min-h-0{min-height:0}
.items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.items-stretch{align-items:stretch}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}.justify-start{justify-content:flex-start}.self-stretch{align-self:stretch}
.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-rows-2{grid-template-rows:repeat(2,minmax(0,1fr))}.row-span-2{grid-row:span 2/span 2}
.gap-0\.5{gap:2px}.gap-1{gap:4px}.gap-2{gap:8px}.gap-3{gap:12px}.gap-4{gap:16px}.gap-5{gap:20px}.gap-x-3{column-gap:12px}.gap-x-5{column-gap:20px}.gap-y-1{row-gap:4px}
.p-3{padding:12px}.p-4{padding:16px}.px-1{padding-inline:4px}.px-2{padding-inline:8px}.px-2\.5{padding-inline:10px}.px-3{padding-inline:12px}.px-4{padding-inline:16px}.px-5{padding-inline:20px}.px-6{padding-inline:24px}
.py-1{padding-block:4px}.py-1\.5{padding-block:6px}.py-2{padding-block:8px}.py-3{padding-block:12px}.py-4{padding-block:16px}.py-6{padding-block:24px}.py-8{padding-block:32px}
.pt-1{padding-top:4px}.pt-2{padding-top:8px}.pt-3{padding-top:12px}.pt-4{padding-top:16px}.pb-1{padding-bottom:4px}.pb-1\.5{padding-bottom:6px}.pb-2{padding-bottom:8px}.pb-3{padding-bottom:12px}.pb-4{padding-bottom:16px}
.ps-1{padding-inline-start:4px}.ps-5{padding-inline-start:20px}.pe-3{padding-inline-end:12px}
.px-horizontal{padding-inline:var(--spacing-horizontal)}.py-vertical{padding-block:var(--spacing-vertical)}
.mx-auto{margin-inline:auto}.mx-4{margin-inline:16px}.-mx-2{margin-inline:-8px}.ms-auto{margin-inline-start:auto}.ms-1{margin-inline-start:4px}.ms-\[12px\]{margin-inline-start:12px}.-ms-2{margin-inline-start:-8px}.me-4{margin-inline-end:16px}.-me-\[5px\]{margin-inline-end:-5px}
.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.mt-auto{margin-top:auto}.mb-3{margin-bottom:12px}.mb-4{margin-bottom:16px}.my-4{margin-block:16px}.-mb-3{margin-bottom:-12px}.-my-2{margin-block:-8px}
.w-full{width:100%}.w-fit{width:fit-content}.w-5{width:20px}.w-8{width:32px}.w-10{width:40px}.w-0\.5{width:2px}.w-\[34px\]{width:34px}.w-\[calc\(100\%\+16px\)\]{width:calc(100% + 16px)}
.h-3{height:12px}.h-5{height:20px}.h-6{height:24px}.h-8{height:32px}.h-9{height:36px}.h-10{height:40px}.h-11{height:44px}.h-12{height:48px}.h-\[34px\]{height:34px}.h-\[53px\]{height:53px}.h-full{height:100%}.h-auto{height:auto}
.min-h-4{min-height:16px}.min-h-5{min-height:20px}.min-h-6{min-height:24px}.min-h-\[28px\]{min-height:28px}.min-h-\[120px\]{min-height:120px}.min-h-full{min-height:100%}
.size-0{width:0;height:0}.size-4{width:16px;height:16px}.size-5{width:20px;height:20px}.size-6{width:24px;height:24px}.size-7{width:28px;height:28px}.size-8{width:32px;height:32px}.size-10{width:40px;height:40px}.size-12{width:48px;height:48px}.size-full{width:100%;height:100%}
.size-\[50px\]{width:50px;height:50px}.size-\[30px\]{width:30px;height:30px}.size-\[26px\]{width:26px;height:26px}.size-\[34px\]{width:34px;height:34px}.size-\[1em\]{width:1em;height:1em}.size-\[18px\]{width:18px;height:18px}
.max-w-full{max-width:100%}.max-w-\[75\%\]{max-width:75%}.max-w-\[1024px\]{max-width:1024px}.max-w-\(--x-main-column-width\){max-width:var(--x-main-column-width)}.max-w-\[var\(--x-timeline-max-width\,600px\)\]{max-width:var(--x-timeline-max-width,600px)}
.min-h-\(--x-page-height\){min-height:var(--x-page-height)}
.aspect-video{aspect-ratio:16/9}.aspect-\[3\/1\]{aspect-ratio:3/1}
.relative{position:relative}.absolute{position:absolute}.fixed{position:fixed}.sticky{position:sticky}
.inset-0{inset:0}.top-0{top:0}.bottom-0{bottom:0}.start-0{inset-inline-start:0}.top-3{top:12px}.bottom-3{bottom:12px}.start-3{inset-inline-start:12px}.end-3{inset-inline-end:12px}.-top-3{top:-12px}.top-\[53px\]{top:53px}
.z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-40{z-index:40}.z-50{z-index:50}
.overflow-hidden{overflow:hidden}.overflow-x-clip{overflow-x:clip}.overflow-x-auto{overflow-x:auto;scrollbar-width:none}.overflow-y-auto{overflow-y:auto}.overflow-visible{overflow:visible}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.whitespace-nowrap{white-space:nowrap}.whitespace-pre-wrap{white-space:pre-wrap}.wrap-anywhere{overflow-wrap:anywhere}.wrap-break-word{overflow-wrap:break-word}
.line-clamp-1{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}.line-clamp-2{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.text-center{text-align:center}
.rounded-full{border-radius:9999px}.rounded-md{border-radius:var(--radius-md)}.rounded-2xl{border-radius:16px}.rounded-3xl{border-radius:24px}.rounded-xs{border-radius:2px}.rounded-sm{border-radius:4px}.rounded-\[10\%\]{border-radius:10%}.rounded-none{border-radius:0}.rounded-br-md{border-bottom-right-radius:6px}.rounded-bl-md{border-bottom-left-radius:6px}
.border{border-width:1px}.border-b{border-bottom-width:1px}.border-t{border-top-width:1px}.border-e{border-inline-end-width:1px}.border-4{border-width:4px}
.border-normal{border-color:var(--x-border-normal)}.border-divider{border-color:var(--x-border-divider)}.border-transparent{border-color:transparent}.border-media{border-color:var(--x-border-media)}.border-fg-alpha-06{border-color:var(--x-fg-alpha-06)}.border-primary{border-color:var(--x-bg-primary)}
.bg-primary{background-color:var(--x-bg-primary)}.bg-primary\/80{background-color:color-mix(in oklab,var(--x-bg-primary) 80%,transparent)}.bg-secondary{background-color:var(--x-bg-secondary)}.bg-tertiary{background-color:var(--x-bg-tertiary)}.bg-modal{background-color:var(--x-bg-modal)}.bg-inputs{background-color:var(--x-bg-inputs)}
.bg-btn-primary{background-color:var(--x-btn-primary)}.bg-brand{background-color:var(--x-btn-brand)}.bg-black{background-color:#000}.bg-black-40{background-color:var(--x-black-40)}.bg-black-80{background-color:var(--x-black-80)}.bg-\(--x-border-normal\){background-color:var(--x-border-normal)}.bg-\(--x-fg-primary\){background-color:var(--x-fg-primary)}
.text-primary{color:var(--x-fg-primary)}.text-secondary{color:var(--x-fg-secondary)}.text-brand{color:var(--x-fg-brand)}.text-inverted{color:var(--x-fg-inverted)}.text-white,.text-on-color{color:#fff}.text-magenta-500{color:var(--x-magenta-500)}.text-green-500{color:var(--x-green-500)}.text-red-500{color:var(--x-red-500)}
.text-body{font-size:15px;line-height:20px}.text-subtext1{font-size:14px;line-height:16px}.text-subtext2{font-size:13px;line-height:16px}.text-subtext3{font-size:12px;line-height:16px}.text-headline1{font-size:20px;line-height:24px}.text-headline2{font-size:17px;line-height:20px}.text-title4{font-size:23px;line-height:28px}
.text-\[20px\]{font-size:20px}.text-\[17px\]{font-size:17px}.text-\[15px\]{font-size:15px}.text-\[14px\]{font-size:14px}.text-\[13px\]{font-size:13px}.text-\[11px\]{font-size:11px}.leading-4{line-height:16px}.leading-5{line-height:20px}.leading-6{line-height:24px}
.font-normal{font-weight:400}.font-medium{font-weight:500}.font-bold{font-weight:700}.font-extrabold{font-weight:800}.tabular-nums{font-variant-numeric:tabular-nums}
.cursor-pointer{cursor:pointer}.pointer-events-none{pointer-events:none}.select-none{user-select:none}.invisible{visibility:hidden}
.object-cover{object-fit:cover}.object-contain{object-fit:contain}
.backdrop-blur-md{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}.backdrop-blur-lg{-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.transition-colors{transition:color .15s,background-color .15s,border-color .15s}.outline-none{outline:none}
.empty\:hidden:empty{display:none}
.hover\:bg-hover-subtle:hover,.group:hover .group-hover\:bg-hover-subtle{background-color:var(--x-hover-subtle)}
.hover\:bg-hover-faint:hover{background-color:var(--x-hover-faint)}.hover\:bg-btn-ghost-hover:hover{background-color:var(--x-btn-ghost-hover)}.hover\:bg-btn-primary-hover:hover:not(:disabled){background-color:var(--x-btn-primary-hover)}
.hover\:underline:hover{text-decoration:underline}.hover\:brightness-90:hover{filter:brightness(.9)}
.hover\:text-brand:hover{color:var(--x-fg-brand)}.hover\:text-green-500:hover{color:var(--x-green-500)}.hover\:text-magenta-500:hover{color:var(--x-magenta-500)}.hover\:text-primary:hover{color:var(--x-fg-primary)}
.data-active\:text-primary[data-active]{color:var(--x-fg-primary)}
.after\:border:after{content:"";position:absolute;inset:0;z-index:10;pointer-events:none;border:1px solid var(--x-border-normal);border-radius:inherit}
@media (min-width:640px){.sm\:block{display:block}.sm\:flex{display:flex}.sm\:hidden{display:none}.sm\:border-x{border-inline-width:1px}.sm\:w-\[600px\]{width:600px}.sm\:rounded-2xl{border-radius:16px}.sm\:min-h-0{min-height:0}.sm\:py-\[5vh\]{padding-block:5vh}}
@media (min-width:768px){.md\:w-\[380px\]{width:380px}.md\:hidden{display:none}}
@media (max-width:767.98px){.max-md\:hidden{display:none}}
@media (min-width:1024px){.lg\:flex{display:flex}.lg\:hidden{display:none}.lg\:grid-cols-\[var\(--x-main-column-width\)_minmax\(0\,1fr\)\]{grid-template-columns:var(--x-main-column-width) minmax(0,1fr)}}
@media (max-width:1023.98px){.max-lg\:max-w-\(--x-main-column-width\){max-width:var(--x-main-column-width)}}
@media (min-width:1280px){.xl\:max-w-\[1280px\]{max-width:1280px}}

/* layout helpers (the real client expresses these with arbitrary-value utilities) */
.x-root{--x-main-column-width:600px;--x-sidebar-wide:0}
@media (min-width:1280px){.x-root{--x-sidebar-wide:1}}
.x-sidebar{--x-sidebar-open:1;--x-sidebar-expanded:calc(var(--x-sidebar-wide,0) * var(--x-sidebar-open));width:calc(72px + 184px * var(--x-sidebar-expanded,0));height:100dvh;top:0}
.x-nav-label,.x-wide-only,.x-post-label{display:none}
@media (min-width:1280px){.x-nav-label,.x-post-label{display:inline}.x-wide-only{display:flex}.x-narrow-only{display:none}}
.x-nav-item{display:flex;margin-inline-start:11px;border-radius:9999px;color:var(--x-fg-primary)}
.x-nav-pill{display:flex;align-items:center;gap:20px;padding:12px;border-radius:9999px;transition:background-color .2s}
.x-nav-item:hover .x-nav-pill{background-color:var(--x-hover-subtle)}
.x-nav-label{font-size:20px;line-height:24px;margin-inline-end:16px;white-space:nowrap}
.x-nav-item[aria-current=page] .x-nav-label{font-weight:700}.x-nav-item[aria-current=page] svg{stroke-width:2.75}
.x-nav-badge{position:absolute;top:-6px;inset-inline-end:-7px;display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding-inline:5px;border-radius:9999px;background-color:var(--x-btn-brand);color:#fff;font-size:11px;font-weight:700;line-height:1;border:1px solid var(--x-bg-primary)}
.x-post-btn{display:flex;align-items:center;justify-content:center;margin:16px 0 0 11px;width:50px;height:50px;border-radius:9999px;background-color:var(--x-btn-primary);color:var(--x-fg-inverted);font-weight:700;font-size:17px;transition:background-color .2s}
.x-post-btn:hover{background-color:var(--x-btn-primary-hover)}
@media (min-width:1280px){.x-post-btn{width:calc(100% - 34px);height:52px}}
.x-account-btn{display:flex;align-items:center;gap:12px;margin:12px 0 12px 7px;padding:4px;border-radius:9999px;transition:background-color .2s;text-align:start}
.x-account-btn:hover{background-color:var(--x-hover-subtle)}
@media (min-width:1280px){.x-account-btn{width:calc(100% - 22px);padding:12px}}
.x-avatar{flex-shrink:0;overflow:hidden}
.x-middot-group{display:flex;flex-shrink:1;align-items:center;min-width:0}
.x-middot-group>:not(:first-child):before{content:"\00B7";padding-inline:4px;flex-shrink:0;display:inline-block;color:var(--x-fg-secondary)}
.x-engagement-button{display:inline-flex;align-items:center;border-radius:9999px;outline-color:var(--x-ring)}
.x-engagement-pill{isolation:isolate;position:relative;display:inline-flex;align-items:center;border-radius:9999px}
.x-engagement-pill>:first-child{width:18.75px;height:18.75px}
.x-engagement-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:9999px;opacity:0;background-color:color-mix(in srgb,currentColor 12%,transparent);transition:opacity .15s}
.x-engagement-button:hover .x-engagement-pill:before{opacity:1}
.x-tablist{scrollbar-width:none}.x-tablist::-webkit-scrollbar{display:none}
.x-tab{position:relative;display:flex;flex:1 0 auto;align-items:center;justify-content:center;white-space:nowrap;padding:16px;font-size:15px;line-height:20px;font-weight:500;color:var(--x-fg-secondary);transition:background-color .2s}
.x-tab:hover{background-color:var(--x-hover-subtle)}
.x-tab[data-active]{color:var(--x-fg-primary);font-weight:700}
.x-tab [data-tab-underline]{position:absolute;left:0;right:0;bottom:-16px;height:4px;border-radius:9999px;visibility:hidden}
.x-tab[data-active] [data-tab-underline]{visibility:visible}
.x-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:9999px;font-weight:700;user-select:none;white-space:nowrap;transition:background-color .15s}
.x-button:disabled{opacity:.5}
.x-follow{height:32px;padding-inline:16px;font-size:14px;flex-shrink:0}
.x-follow[aria-label^="Following"]{border:1px solid var(--x-border-normal);color:var(--x-fg-primary);background-color:transparent}
.x-follow[aria-label^="Follow @"]{background-color:var(--x-btn-primary);color:var(--x-fg-inverted)}
.x-editor{white-space:pre-wrap;overflow-wrap:anywhere}
.x-editor:empty:before{content:attr(data-placeholder);color:var(--x-fg-secondary);pointer-events:none}
.x-menu{position:fixed;z-index:60;min-width:220px;max-width:360px;padding-block:4px;border-radius:16px;background-color:var(--x-bg-modal);border:1px solid var(--x-border-normal);box-shadow:var(--x-shadow-popup);overflow:hidden;outline:none}
.x-menuitem{display:flex;align-items:center;gap:12px;padding:12px 16px;font-size:15px;font-weight:700;line-height:20px;cursor:pointer;outline:none;color:var(--x-fg-primary)}
.x-menuitem:hover,.x-menuitem:focus{background-color:var(--x-hover-subtle)}
.x-menuitem svg{width:18.75px;height:18.75px;flex-shrink:0}
.x-searchbox{display:flex;align-items:center;gap:12px;height:44px;padding-inline:16px;border-radius:9999px;border:1px solid var(--x-border-normal);background-color:var(--x-bg-primary);color:var(--x-fg-secondary)}
.x-searchbox:focus-within{border-color:var(--x-fg-brand);color:var(--x-fg-brand)}
.x-searchbox input{flex:1;min-width:0;height:100%;color:var(--x-fg-primary);font-size:15px}
.x-card-row{padding:12px 20px;transition:background-color .2s}.x-card-row:hover{background-color:var(--x-hover-faint)}
.x-row{padding:12px 16px;border-bottom:1px solid var(--x-border-divider);transition:background-color .2s}.x-row:hover{background-color:var(--x-hover-faint)}
.x-profile-top{position:relative;display:flex;justify-content:flex-end;align-items:flex-start;gap:8px;padding-top:12px;min-height:calc(clamp(48px,25vw,134px) / 2 + 12px)}
.x-profile-avatar{position:absolute;inset-inline-start:0;top:0;width:clamp(48px,25vw,134px);aspect-ratio:1;transform:translateY(-50%)}
.x-wide{max-width:none!important}
@media (min-width:1024px){.x-wide{grid-column:span 2/span 2}}
.x-chat{height:100dvh;position:sticky;top:0}
.x-photo-viewer{background-color:rgba(0,0,0,.9)}
.x-photo-viewer img{max-width:calc(100vw - 120px);max-height:calc(100vh - 96px);width:auto;height:auto;object-fit:contain}
.x-iconbtn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;transition:background-color .2s}.x-iconbtn:hover{background-color:var(--x-hover-subtle)}
.x-viewer-btn{position:absolute;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background-color:rgba(0,0,0,.6);color:#fff;backdrop-filter:blur(4px)}
@keyframes x-spin{to{transform:rotate(360deg)}}.x-spin{animation:x-spin .8s linear infinite}
`;

const SYMBOL_ATTR = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const BADGE_PATH = 'M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z';
const CHECK_PATH = '<path fill="#fff" d="M10.54 16.2l-3.62-3.61 1.42-1.42 2.15 2.15 5.04-5.39 1.46 1.37z"/>';
const HEART = 'M12 20.3s-7.6-4.6-9.2-9.3C1.7 7.5 3.9 4 7.4 4c2.1 0 3.6 1.1 4.6 2.6C13 5.1 14.5 4 16.6 4c3.5 0 5.7 3.5 4.6 7-1.6 4.7-9.2 9.3-9.2 9.3z';
const BOOKMARK = 'M6 3.5h12v17.2l-6-4.3-6 4.3z';
const SPRITE = `<svg aria-hidden="true" class="absolute size-0 overflow-hidden"><symbol id="icon-reply" viewBox="0 0 24 24"><path ${SYMBOL_ATTR} d="M4.5 11.5a7 7 0 0 1 7-7h1.5a7 7 0 0 1 0 14h-1.2l-5.3 3.2v-3.9a7 7 0 0 1-2-6.3z"/></symbol><symbol id="icon-repost" viewBox="0 0 24 24"><path ${SYMBOL_ATTR} d="M7 3.5 4 6.5l3 3M4 6.5h11a4 4 0 0 1 4 4v1.5M17 20.5l3-3-3-3M20 17.5H9a4 4 0 0 1-4-4V12"/></symbol><symbol id="icon-heart" viewBox="0 0 24 24"><path ${SYMBOL_ATTR} d="${HEART}"/></symbol><symbol id="icon-heart-filled" viewBox="0 0 24 24"><path fill="currentColor" d="${HEART}"/></symbol><symbol id="icon-bookmark" viewBox="0 0 24 24"><path ${SYMBOL_ATTR} d="${BOOKMARK}"/></symbol><symbol id="icon-bookmark-filled" viewBox="0 0 24 24"><path fill="currentColor" d="${BOOKMARK}"/></symbol><symbol id="icon-share-ios" viewBox="0 0 24 24"><path ${SYMBOL_ATTR} d="M12 3v12.5"/><path ${SYMBOL_ATTR} d="M7.5 7.5 12 3l4.5 4.5M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13"/></symbol><symbol id="icon-bar-chart" viewBox="0 0 24 24"><path ${SYMBOL_ATTR} d="M5 20v-8M10 20V4M15 20v-6M20 20V9"/></symbol><symbol id="icon-more-dots-hor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="19" cy="12" r="1.9" fill="currentColor"/></symbol><symbol id="icon-verified-premium-color" viewBox="0 0 24 24"><path fill="#1d9bf0" d="${BADGE_PATH}"/>${CHECK_PATH}</symbol><symbol id="icon-verified-business-color" viewBox="0 0 24 24"><path fill="#e2b719" d="${BADGE_PATH}"/>${CHECK_PATH}</symbol><symbol id="icon-verified-government-color" viewBox="0 0 24 24"><path fill="#829aab" d="${BADGE_PATH}"/>${CHECK_PATH}</symbol></svg>`;

/* ------------------------------------------------------------------------------------------------
 * Client-side app. Serialised with Function.prototype.toString(), so it must be self-contained.
 * --------------------------------------------------------------------------------------------- */
function mockXClient() {
  'use strict';
  if (window.__mockXBoot) return;
  window.__mockXBoot = Date.now();
  window.__mockXRenders = 0;

  const NOW = Date.UTC(2026, 10, 22, 18, 0, 0);
  const ME = 'orbit_tester';
  const PBS = 'https://pbs.twimg.com';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  function syncParams() {
    const q = new URLSearchParams(location.search);
    if (q.has('theme')) store.set('mockx:theme', q.get('theme') === 'light' ? 'light' : 'dark');
    if (q.has('loggedout')) store.set('mockx:loggedout', /^(1|true)$/.test(q.get('loggedout')) ? '1' : '0');
  }
  syncParams();
  document.documentElement.setAttribute('data-theme', store.get('mockx:theme') || 'dark');
  const isLoggedIn = () => store.get('mockx:loggedout') !== '1';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const fmt = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e5) return Math.floor(n / 1e3) + 'K';
    if (n >= 1e3) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };
  const iso = (t) => new Date(t).toISOString().replace('.000Z', '.000Z');
  function relTime(t) {
    const d = NOW - t;
    if (d < 60e3) return 'now';
    if (d < 3600e3) return Math.floor(d / 60e3) + 'm';
    if (d < 86400e3) return Math.floor(d / 3600e3) + 'h';
    const dt = new Date(t);
    return `${MON[dt.getUTCMonth()]} ${dt.getUTCDate()}${dt.getUTCFullYear() !== 2026 ? ', ' + dt.getUTCFullYear() : ''}`;
  }
  function fullTime(t) {
    const dt = new Date(t);
    const h = dt.getUTCHours();
    return `${h % 12 || 12}:${String(dt.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} · ${MON[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
  }
  const api = (type, body) => fetch('/i/api/mock/' + type, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }).catch(() => {});

  /* ------------------------------------------------------------------ data */
  const USER_DEFS = [
    ['orbit_tester', 'Orbit Tester', { bio: 'Kicking the tyres on Orbit, a calmer way to browse. Every post here is deterministic.', loc: 'Low Earth orbit', joined: 'March 2019', followers: 1284, following: 312, posts: 12300 }],
    ['NASA', 'NASA', { v: 'government', square: true, bio: 'There’s space for everybody. ✨', loc: 'Pale Blue Dot', joined: 'December 2007', followers: 92100000, following: 115, posts: 74500 }],
    ['Space_Station', 'International Space Station', { v: 'government', square: true, bio: 'NASA’s page for updates from the International Space Station, the world-class lab orbiting Earth 16 times a day.', loc: 'Low Earth Orbit', joined: 'January 2009', followers: 4600000, following: 270, posts: 21800 }],
    ['mountainlight', 'Mountain Light', { v: 'premium', bio: 'Landscape photographer. Chasing fog and first light.', loc: 'The Alps', followers: 284000 }],
    ['quietcoder', 'Quiet Coder', { v: 'premium', bio: 'Writes small tools. Prefers boring technology.', followers: 51200 }],
    ['designnotes', 'Design Notes', { v: 'premium', bio: 'Notes on interface design, type and craft.', followers: 132000 }],
    ['pixelpusher', 'Pixel Pusher', { bio: 'Product designer. Grids are a love language.' }],
    ['tidepool_', 'Tide Pool', { bio: 'Marine biology, rock pools and the occasional crab.' }],
    ['orbitnews', 'Orbit Daily News', { v: 'business', square: true, bio: 'Breaking news and analysis, every day.', followers: 2400000 }],
    ['ferris_fan', 'Ferris Fan', { bio: 'Rustacean. Compiler whisperer.' }],
    ['nightowl_42', 'Night Owl', { bio: 'Astrophotography after midnight.' }],
    ['typeface_daily', 'Typeface Daily', { v: 'premium', bio: 'One typeface a day.' }],
    ['sunsetchaser', 'Sunset Chaser', { bio: 'Golden hour enthusiast.' }],
    ['acmecloud', 'Acme Cloud', { v: 'business', square: true, bio: 'The cloud that scales with you.' }],
  ];
  const USERS = {};
  USER_DEFS.forEach(([handle, name, o], i) => {
    USERS[handle.toLowerCase()] = {
      handle, name, verified: o.v || null, square: !!o.square, bio: o.bio || '', loc: o.loc || '', joined: o.joined || 'June 2014',
      followers: o.followers ?? 1000 + (hash(handle) % 90000), following: o.following ?? 50 + (hash(handle) % 2000), posts: o.posts ?? 500 + (hash(handle) % 60000),
      avatar: handle === ME ? `${PBS}/profile_images/1/me_normal.jpg` : `${PBS}/profile_images/${1000 + i}/${handle}_normal.jpg`,
      banner: `${PBS}/profile_banners/${2000 + i}/1788992290/1500x500?w=1500&h=500`,
    };
  });
  function getUser(h) {
    const k = String(h).toLowerCase();
    if (USERS[k]) return USERS[k];
    const n = hash(k);
    return (USERS[k] = {
      handle: h, name: h.charAt(0).toUpperCase() + h.slice(1).replace(/_/g, ' '), verified: null, square: false, bio: '', loc: '', joined: 'May 2016',
      followers: 100 + (n % 50000), following: 20 + (n % 900), posts: 10 + (n % 9000),
      avatar: `${PBS}/profile_images/${9000 + (n % 1000)}/${h}_normal.jpg`, banner: `${PBS}/profile_banners/${9000 + (n % 1000)}/1788992290/1500x500?w=1500&h=500`,
    });
  }
  const avatarUrl = (u, size) => u.avatar.replace('_normal.', `_${size}.`);

  const NASA_TEXT = 'LIVE: Watch as an uncrewed SpaceX Dragon spacecraft undocks from the @Space_Station and begins its journey to bring research samples and hardware back to Earth.';
  const TEXTS = [
    'Golden hour over the Dolomites this morning. Worth every minute of the 4am alarm.',
    'Hot take: most loading spinners should be skeleton screens.',
    'Shipped a tiny CLI that formats dates the way humans actually say them. #buildinpublic',
    'Fog rolling into the valley — no filter, just patience.',
    'What is one small habit that genuinely improved your work this year?',
    'New type specimen just dropped. Look at those ink traps 👀 #typography',
    'Reminder: the best camera is the one you have with you.',
    'Rust 1.92 is out and incremental builds feel noticeably faster. #rustlang',
    'Low tide at sunrise. The rock pools are full of tiny crabs today 🦀',
    'Tonight the Moon passes in front of the Pleiades. Look east after sunset! 🌙',
    'Breaking: the city council approved the new protected bike lane network after a six-hour meeting.',
    'Good interfaces are invisible until they get in your way.',
    'We just open-sourced the design tokens we use across every product. Feedback welcome @designnotes',
    'Spent the weekend repairing a 1974 film camera. It works. I am unreasonably happy.',
  ];
  const LONG = [
    'A short thread on why software feels slow even on fast hardware. First, latency budgets are rarely enforced, so every layer quietly adds a few milliseconds. Second, we ship more JavaScript than ever, and parsing it is not free. Third, layout thrashing hides in innocent-looking code. Fourth, animations are often used to mask work instead of reflecting it. Fifth, nobody owns the end-to-end feel of the product. The fix is boring: measure, set budgets, and make someone responsible for how it feels.',
    'Three years ago I started photographing the same valley every morning. Some days there is nothing but grey. Other days the fog pours over the ridge like a slow waterfall. I have learned more about light from those grey days than from any workshop. Patience is a technique, not a personality trait. You show up, you wait, and occasionally the world rewards you. Today was one of those days.',
  ];
  const FOLLOWING_TEXTS = [
    'Crew members are wrapping up a week of plant-growth experiments aboard the station. 🌱',
    'A grid is not a cage. It is a promise you make to the reader.',
    'First snow on the high ridge today. The light was soft and blue all morning.',
    'Markets close higher as tech shares rally for a third straight session.',
    'Small PRs get reviewed. Big PRs get approved.',
    'The Artemis II crew completed another full-scale launch-day rehearsal this week.',
  ];
  const BOOKMARK_TEXTS = [
    'The best explanation of CSS stacking contexts I have ever read. Bookmark this.',
    'Recipe: slow-roasted tomatoes, garlic, olive oil, three hours at 120°C. That is it.',
    'A field guide to the birds you will see on a winter coastal walk.',
    'Every keyboard shortcut I use daily, in one image.',
    'How we cut our cloud bill by 40% without touching the product.',
    'Reading list for anyone getting into typography.',
    'Ten minutes of the northern lights over Tromsø, uncut.',
    'Thread: the questions I ask in every design critique.',
  ];
  const REPLY_TEXTS = [
    'This is incredible. Thanks for sharing!', 'Saving this for later 🔖', 'Can you share more about how this was done?', 'The colours in this are unreal.',
    'Underrated post right here.', 'Came here to say exactly this.', 'Following for updates.', 'Big if true.',
  ];
  const AD_TEXT = 'Deploy globally in seconds. Acme Cloud scales with you from the first request to the billionth. Start free today.';

  const POSTS = new Map();
  function mediaId(seed) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let h = hash(seed) || 1;
    let s = 'G';
    for (let k = 0; k < 14; k++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; s += A[(h >>> 16) % 64]; }
    return s;
  }
  function countsFor(seed) {
    const h = hash(seed + 'c');
    return { reply: 3 + (h % 380), repost: 12 + ((h >>> 4) % 3100), like: 140 + ((h >>> 8) % 24000), bookmark: 2 + ((h >>> 3) % 950), view: 9000 + ((h >>> 2) % 1400000) };
  }
  function addPost(o) {
    const p = Object.assign({ media: [], video: null, quote: null, repostedBy: null, promoted: false, replyTo: null, liked: false, reposted: false, bookmarked: false }, o);
    if (!p.counts) p.counts = countsFor(p.id);
    POSTS.set(p.id, p);
    return p;
  }
  const photosFor = (id, sizes) => sizes.map(([w, h], k) => ({ mid: mediaId(id + ':' + k), w, h }));
  const IMG1 = [[1200, 675], [1080, 1350], [1600, 1200], [1920, 1279]];
  const KINDS = ['text', 'image1', 'long', 'repost', 'image2', 'quote', 'promoted', 'image4', 'video', 'text'];
  const FY_AUTHORS = ['mountainlight', 'quietcoder', 'orbitnews', 'designnotes', 'pixelpusher', 'tidepool_', 'ferris_fan', 'nightowl_42', 'typeface_daily', 'sunsetchaser', 'Space_Station', 'NASA'];

  function genPost(id, kind, author, i, extra) {
    extra = extra || {};
    const o = { id, author, time: NOW - (i * 53 + 7) * 60e3, text: TEXTS[(i * 7 + hash(author)) % TEXTS.length] };
    switch (kind) {
      case 'image1': o.media = photosFor(id, [IMG1[Math.floor(i / 10) % 4]]); break;
      case 'image2': o.media = photosFor(id, [[1200, 1200], [1200, 1200]]); break;
      case 'image4': o.media = photosFor(id, [[1200, 900], [1200, 900], [1200, 900], [1200, 900]]); break;
      case 'long': o.text = LONG[i % LONG.length]; break;
      case 'video': o.video = { mid: '2123435905' + String(390100480 + i), w: 1280, h: 720, dur: `0:${String(12 + (i % 47)).padStart(2, '0')}` }; break;
      case 'repost': {
        let by = i === 3 ? 'NASA' : FY_AUTHORS[(i * 5 + 7) % FY_AUTHORS.length];
        if (by.toLowerCase() === author.toLowerCase()) by = 'quietcoder';
        o.repostedBy = by;
        o.media = photosFor(id, [[1600, 900]]);
        break;
      }
      case 'quote': {
        const qa = FY_AUTHORS[(i + 4) % FY_AUTHORS.length];
        const qid = '2123700' + id.slice(7);
        const q = POSTS.get(qid) || addPost({ id: qid, author: qa === author ? 'NASA' : qa, time: o.time - 5 * 3600e3, text: TEXTS[(i * 3 + 5) % TEXTS.length], media: i % 20 < 10 ? photosFor(qid, [[1200, 675]]) : [] });
        o.quote = q.id;
        o.text = 'This is exactly what I was talking about yesterday.';
        break;
      }
      case 'promoted': o.author = 'acmecloud'; o.text = AD_TEXT; o.promoted = true; o.media = photosFor(id, [[1200, 628]]); break;
      default: break;
    }
    return addPost(Object.assign(o, extra));
  }
  function homePost(i) {
    const id = '2123820070' + String(803542306 - i * 104729).padStart(9, '0');
    if (POSTS.has(id)) return POSTS.get(id);
    const kind = KINDS[i % 10];
    let author = i === 0 ? 'NASA' : FY_AUTHORS[(i * 5 + 2) % FY_AUTHORS.length];
    if (kind === 'repost' && i === 3) author = 'Space_Station';
    return genPost(id, kind, author, i, i === 0 ? { text: NASA_TEXT } : undefined);
  }
  const FOLLOWING_AUTHORS = ['Space_Station', 'designnotes', 'mountainlight', 'orbitnews', 'quietcoder', 'NASA'];
  const FOLLOWING_KINDS = ['text', 'text', 'image1', 'text', 'long', 'image2'];
  function followingPost(i) {
    const id = '2123811' + String(555000000000 - i * 7919).padStart(12, '0');
    if (POSTS.has(id)) return POSTS.get(id);
    const kind = FOLLOWING_KINDS[i % 6];
    return genPost(id, kind, FOLLOWING_AUTHORS[i % 6], i + 1, Object.assign({ time: NOW - (i * 71 + 3) * 60e3 }, kind === 'long' ? {} : { text: FOLLOWING_TEXTS[i % 6] }));
  }
  const BOOKMARK_KINDS = ['text', 'image1', 'long', 'text', 'image2', 'text', 'video', 'text'];
  function bookmarkPost(i) {
    const id = '2123822' + String(444000000000 - i * 6997).padStart(12, '0');
    if (POSTS.has(id)) return POSTS.get(id);
    const kind = BOOKMARK_KINDS[i];
    return genPost(id, kind, FY_AUTHORS[(i * 7 + 3) % FY_AUTHORS.length], i * 9 + 2, Object.assign({ bookmarked: true, time: NOW - (i * 1900 + 600) * 60e3 }, kind === 'long' ? {} : { text: BOOKMARK_TEXTS[i] }));
  }
  const PROFILE_KINDS = ['text', 'image1', 'text', 'long', 'image2', 'text', 'video', 'text', 'image4', 'text'];
  function profilePosts(handle) {
    const u = getUser(handle);
    const pre = '2123833' + String(hash(u.handle.toLowerCase()) % 1e6).padStart(6, '0');
    const out = [];
    for (let i = 0; i < 10; i++) {
      const id = pre + String(i).padStart(6, '0');
      out.push(POSTS.get(id) || genPost(id, PROFILE_KINDS[i], u.handle, i * 3 + 1, Object.assign({ time: NOW - (i * 410 + 25) * 60e3 }, i === 0 && u.handle === 'NASA' ? { text: NASA_TEXT } : {})));
    }
    return out;
  }
  function searchPosts(q, live) {
    const templates = [`Just read a great thread about ${q}. Highly recommend.`, `Anyone else following the ${q} news today?`, `${q} is trending and honestly I get why.`, `Hot take: ${q} is underrated.`, `New photos from the ${q} meetup 📸`, `Wrote up everything I learned about ${q} this year.`];
    const pre = '2123844' + String(hash(q) % 1e6).padStart(6, '0');
    const out = templates.map((text, i) => {
      const id = pre + String(i).padStart(6, '0');
      return POSTS.get(id) || genPost(id, i === 4 ? 'image1' : 'text', FY_AUTHORS[(hash(q) + i * 5) % FY_AUTHORS.length], i * 4 + 1, { text, time: NOW - (i * 97 + 11) * 60e3 });
    });
    return live ? out.slice().sort((a, b) => b.time - a.time) : out;
  }
  function repliesFor(p) {
    const pre = '2123866' + String(hash(p.id) % 1e6).padStart(6, '0');
    const others = FY_AUTHORS.filter((h) => h.toLowerCase() !== p.author.toLowerCase());
    const out = [];
    for (let k = 0; k < 6; k++) {
      const id = pre + String(k).padStart(6, '0');
      if (POSTS.has(id)) { out.push(POSTS.get(id)); continue; }
      const self = k === 0;
      out.push(addPost({
        id, author: self ? p.author : others[(hash(p.id) + k * 3) % others.length], replyTo: self ? p.id : k === 1 ? pre + '000000' : p.id,
        time: Math.min(p.time + (k + 1) * 9 * 60e3, NOW - (6 - k) * 60e3 - 1),
        text: self ? 'More context in this thread: the full mission timeline and replays are linked from our site. Questions welcome below 👇' : REPLY_TEXTS[(hash(p.id) + k) % REPLY_TEXTS.length],
        media: k === 3 ? photosFor(id, [[1200, 800]]) : [],
      }));
    }
    return out;
  }
  function getPostFor(id, handle) {
    if (POSTS.has(id)) return POSTS.get(id);
    if (id.startsWith('2123833') && handle) { profilePosts(handle); if (POSTS.has(id)) return POSTS.get(id); }
    return genPost(id, ['text', 'image1', 'text', 'long'][hash(id) % 4], handle || 'NASA', hash(id) % 40);
  }
  // Pre-generate every deterministic set so direct visits to a status URL resolve to the same post.
  for (let i = 0; i < 50; i++) homePost(i);
  for (let i = 0; i < 12; i++) followingPost(i);
  for (let i = 0; i < 8; i++) bookmarkPost(i);
  const MENTIONS = [0, 1, 2].map((i) => addPost({ id: '2123877' + String(i).padStart(12, '0'), author: ['quietcoder', 'designnotes', 'tidepool_'][i], time: NOW - (i * 140 + 30) * 60e3, text: ['@orbit_tester have you tried the new build? It is so much faster.', 'Great question @orbit_tester — we will cover it in the next issue.', '@orbit_tester the crabs say hi 🦀'][i] }));

  const TRENDS = [
    { cat: 'Trending in United States', name: '#Orbit', posts: '12.4K posts', tab: 'trending' },
    { cat: 'Space · Trending', name: 'Artemis III', posts: '48.1K posts', tab: 'news' },
    { cat: 'Technology · Trending', name: 'Rust 1.92', posts: '8,214 posts', tab: 'trending' },
    { cat: 'Sports · Trending', name: 'Champions League', posts: '201K posts', tab: 'sports' },
    { cat: 'Trending', name: '#DesignTwitter', posts: '5,402 posts', tab: 'trending' },
    { cat: 'News · Trending', name: 'Northern lights', posts: '61.3K posts', tab: 'news' },
    { cat: 'Sports · Trending', name: 'Grand Prix', posts: '88.6K posts', tab: 'sports' },
    { cat: 'Politics · Trending', name: 'Bike lanes', posts: '2,118 posts', tab: 'news' },
    { cat: 'Trending in Photography', name: 'Golden hour', posts: '9,876 posts', tab: 'trending' },
    { cat: 'Sports · Trending', name: 'Marathon', posts: '14.9K posts', tab: 'sports' },
    { cat: 'Business & finance · Trending', name: 'Interest rates', posts: '17.2K posts', tab: 'news' },
  ];
  const CONVOS = [
    { id: '1001-2001', with: 'quietcoder', time: '2h', msgs: [[0, 'Did you see the new build?'], [1, 'Yes! Way faster than last week.'], [0, 'Told you caching was the answer 😄']] },
    { id: '1001-2002', with: 'designnotes', time: '5h', msgs: [[0, 'Would you be up for a short interview for the newsletter?'], [1, 'Absolutely, send over the questions.']] },
    { id: '1001-2003', with: 'mountainlight', time: 'Nov 20', msgs: [[1, 'That fog shot is unreal.'], [0, 'Thank you! 4am alarm paid off.']] },
    { id: '1001-2004', with: 'tidepool_', time: 'Nov 18', msgs: [[0, 'Low tide is at 6:40 tomorrow if you want to join.']] },
    { id: '1001-2005', with: 'NASA', time: 'Nov 12', msgs: [[0, 'Thanks for following! Tune in to our next launch broadcast. 🚀']] },
  ];

  const state = {
    homeTab: 'for-you', homeCount: 20, myPosts: [], unread: 3, seq: 0,
    following: new Set(['nasa', 'space_station', 'quietcoder', 'designnotes', 'mountainlight', 'orbitnews']),
    extraReplies: {}, renderedKey: null, pageTitle: 'X', scroll: {}, hist: 0, page: null,
  };
  let shell = null;
  let openMenu = null;
  let modal = null;
  let loadingMore = false;

  /* ------------------------------------------------------------------ components */
  const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V20.5h-5.8v-6.2H9.3v6.2H3.5z"/>',
    explore: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m20.5 20.5-4.9-4.9"/>',
    notifications: '<path d="M5.5 16.5V10a6.5 6.5 0 0 1 13 0v6.5l1.8 2H3.7z"/><path d="M9.8 20.5a2.3 2.3 0 0 0 4.4 0"/>',
    messages: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
    grok: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8.5 15.5 15.5 8.5"/>',
    bookmarks: '<path d="M6 3.5h12v17.2l-6-4.3-6 4.3z"/>',
    communities: '<circle cx="9" cy="8.5" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 14.6c2.9.2 5.5 2.2 5.5 5.4"/>',
    premium: '<path d="M4 4l16 16M20 4 4 20"/>',
    profile: '<circle cx="12" cy="8" r="4.2"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    more: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    feather: '<path d="M20.5 3.5c-7 0-12.5 4.6-13.8 11.2L5 20.5"/><path d="M8.4 13.5h6.1c3.2-1.6 5.3-5 6-10"/>',
    'arrow-left': '<path d="M20 12H4.5M10.5 5.5 4 12l6.5 6.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-4.5-4.5-8.5 8"/>',
    gif: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M10 10.2H8.2v3.6H10v-1.6M12.5 10v4M15 14v-4h2"/>',
    poll: '<path d="M5 6.5h14M5 12h9M5 17.5h11"/>',
    emoji: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9.5 10h.01M14.5 10h.01"/>',
    send: '<path d="M4 12 20.5 4l-4.5 16.5-4-7z"/><path d="m12 13.5 8.5-9.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heartfill: '', person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    location: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    mute: '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5"/>',
    frown: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 16a4.5 4.5 0 0 1 7 0M9.5 10h.01M14.5 10h.01"/>',
    quote: '<path d="M4 20.5 5.2 16A8 8 0 1 1 8 19z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
    play: '',
  };
  const LOGO_PATH = '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>';
  const sicon = (name, cls) => `<svg xmlns="http://www.w3.org/2000/svg" ${STROKE} data-icon="icon-${name}" viewBox="0 0 24 24" display="flex" role="img" width="1em" height="1em" aria-hidden="true" class="${cls || 'size-[26px]'}">${ICONS[name]}</svg>`;
  const useIcon = (id, cls) => `<svg fill="currentColor" viewBox="0 0 24 24" display="flex" role="img" width="1em" height="1em" aria-hidden="true"${cls ? ` class="${cls}"` : ''}><use href="#${id}"></use></svg>`;
  const logo = (cls) => `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" data-icon="icon-logo-x" viewBox="0 0 24 24" display="flex" role="img" width="1em" height="1em" aria-hidden="true" class="${cls}">${LOGO_PATH}</svg>`;
  const playIcon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const spinner = '<div class="flex justify-center py-6" role="progressbar" aria-label="Loading" aria-valuetext="Loading"><svg class="x-spin size-[26px]" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke-width="4" style="stroke:var(--x-fg-brand);opacity:.2"/><circle cx="16" cy="16" r="13" fill="none" stroke-width="4" style="stroke:var(--x-fg-brand);stroke-dasharray:82;stroke-dashoffset:60"/></svg></div>';

  function avatar(u, cls, size) {
    return `<div class="x-avatar ${u.square ? 'rounded-[10%]' : 'rounded-full'} ${cls || 'size-10'} transition duration-200 hover:brightness-90"><img draggable="false" alt="@${esc(u.handle)}" class="size-full object-cover" decoding="async" src="${esc(size ? avatarUrl(u, size) : u.avatar)}"></div>`;
  }
  const avatarLink = (u, cls) => `<a class="x-link max-w-full rounded-none" href="/${esc(u.handle)}">${avatar(u, cls)}</a>`;
  function badge(u, cls) {
    if (!u.verified) return '';
    return `<div class="max-w-full text-body font-normal text-primary flex shrink-0 items-center gap-1"><span aria-label="Verified account" class="flex cursor-pointer items-center" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false"><svg fill="none" viewBox="0 0 24 24" display="flex" role="img" width="1em" height="1em" aria-hidden="true" aria-label="Verified account" class="${cls || 'size-[1em]'} shrink-0"><use href="#icon-verified-${u.verified}-color"></use></svg></span></div>`;
  }
  function richText(t) {
    const span = (inner) => `<span class="max-w-full text-[length:inherit] font-[weight:inherit] text-[color:inherit]">${inner}</span>`;
    return String(t).split(/(@\w{1,15}|#\w+)/g).filter(Boolean).map((part) => {
      if (/^@\w+$/.test(part)) return span(`<a class="rounded-xs x-link hover:underline max-w-full text-brand" href="/${part.slice(1)}">${esc(part)}</a>`);
      if (/^#\w+$/.test(part)) return span(`<a class="rounded-xs x-link hover:underline max-w-full text-brand" href="/hashtag/${part.slice(1)}?src=hashtag_click">${esc(part)}</a>`);
      return span(esc(part));
    }).join('');
  }
  const mediaUrl = (m, name) => `${PBS}/media/${m.mid}?format=jpg&name=${name || 'small'}&w=${m.w}&h=${m.h}`;
  const FRAME = 'relative overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:border after:border-normal rounded-md';

  function photosHTML(p, u) {
    const n = p.media.length;
    if (!n) return '';
    const base = `/${u.handle}/status/${p.id}/photo/`;
    const tile = (m, k, extra) => `<div class="relative h-full w-full min-w-0 min-h-0 overflow-hidden${extra || ''}"><div inert="" class="h-full w-full"><div data-slot="xds-context-menu-trigger" class="h-full w-full"><img fetchpriority="low" width="${m.w}" height="${m.h}" alt="Image" class="${n === 1 ? 'w-full' : 'size-full object-cover'}" decoding="async" loading="lazy" src="${mediaUrl(m)}"></div></div><a aria-label="View media" class="absolute inset-0 z-10" href="${base}${k + 1}"></a></div>`;
    if (n === 1) {
      const m = p.media[0];
      return `<div class="${FRAME}" style="aspect-ratio:${m.w / m.h}"><div class="relative h-full w-full">${tile(m, 0)}</div></div>`;
    }
    return `<div class="${FRAME}" style="aspect-ratio:1.7777777777777777"><div class="grid h-full w-full gap-0.5 ${n === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}">${p.media.map((m, k) => tile(m, k, n === 3 && k === 0 ? ' row-span-2' : '')).join('')}</div></div>`;
  }
  function videoHTML(p) {
    const v = p.video;
    const poster = `${PBS}/amplify_video_thumb/${v.mid}/img/${mediaId(v.mid).slice(1, 13)}.jpg?format=jpg&name=small&w=${v.w}&h=${v.h}`;
    const r = v.w / v.h;
    return `<div class="${FRAME}" style="aspect-ratio:${r}"><div class="w-full" data-press-control="" style="aspect-ratio:${r}"><div class="relative isolate z-0 flex aspect-video h-full w-full overflow-hidden bg-black tabular-nums"><video height="100%" width="100%" disablepictureinpicture="" poster="${poster}" playsinline="" muted="" preload="none" class="size-full object-cover"></video><div class="absolute inset-0 flex w-full" data-slot="xds-context-menu-trigger"><button type="button" aria-label="Play" class="absolute inset-0 z-0 cursor-pointer"></button><div class="x-video-overlay pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span class="flex size-12 items-center justify-center rounded-full bg-black-40 text-white backdrop-blur-lg">${playIcon}</span></div></div><div class="pointer-events-none absolute bottom-3 start-3 z-10"><div class="inline-flex h-5 items-center rounded-sm px-2 font-medium bg-black-80 text-white text-subtext2"><span aria-hidden="true">${v.dur}</span></div></div></div></div></div>`;
  }
  function quoteHTML(q) {
    if (!q) return '';
    const u = getUser(q.author);
    const href = `/${u.handle}/status/${q.id}`;
    return `<div role="link" tabindex="0" data-href="${href}" class="overflow-hidden rounded-2xl border border-normal cursor-pointer transition-colors hover:bg-hover-faint"><div class="flex flex-col gap-1 p-3"><div class="flex min-w-0 items-center gap-1 text-body">${avatar(u, 'size-5')}<span class="truncate font-bold text-primary">${esc(u.name)}</span>${badge(u)}<span class="truncate text-secondary">@${esc(u.handle)}</span><span class="text-secondary">·</span><time class="whitespace-nowrap text-secondary" datetime="${iso(q.time)}">${relTime(q.time)}</time></div><div class="max-w-full text-body font-normal text-primary whitespace-pre-wrap wrap-anywhere" dir="auto" lang="en">${esc(q.text)}</div></div>${q.media.length ? `<div class="aspect-video overflow-hidden border-t border-normal"><img alt="Image" class="size-full object-cover" loading="lazy" src="${mediaUrl(q.media[0])}"></div>` : ''}</div>`;
  }
  function pill(icon, n) {
    return `<span class="x-engagement-pill h-9 px-2.5 [&amp;&gt;:first-child]:size-[18.75px]">${useIcon(icon)}${n === undefined ? '' : `<span class="inline-flex overflow-hidden"><span class="inline-flex tabular-nums text-subtext2 ps-1"><span class="x-animated-count-visual" dir="ltr">${n ? fmt(n) : ''}</span></span></span>`}</span>`;
  }
  const groupLabel = (c) => `${c.reply} replies, ${c.repost} reposts, ${c.like} likes, ${c.bookmark} bookmarks, ${c.view} views`;
  function groupHTML(p) {
    const c = p.counts;
    const EB = 'group x-engagement-button transition-colors';
    return `<div aria-label="${groupLabel(c)}" class="-mx-2 flex h-5 min-h-5 w-[calc(100%+16px)] items-center justify-between overflow-visible @container" role="group">`
      + `<div class="min-w-0 flex-1" data-engagement-action="reply"><a class="x-link max-w-full ${EB} hover:text-brand text-secondary" aria-label="${c.reply} Replies. Reply" href="/compose/post?in_reply_to=${p.id}">${pill('icon-reply', c.reply)}</a></div>`
      + `<div class="min-w-0 flex-1" data-engagement-action="retweet"><button type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" data-slot="xds-menu-trigger" aria-label="${c.repost} reposts. ${p.reposted ? 'Reposted' : 'Repost'}" aria-pressed="${p.reposted}" class="${EB} hover:text-green-500 ${p.reposted ? 'text-green-500' : 'text-secondary'}">${pill('icon-repost', c.repost)}</button></div>`
      + `<div class="min-w-0 flex-1" data-engagement-action="like"><button aria-label="${c.like} Likes. ${p.liked ? 'Liked' : 'Like'}" aria-pressed="${p.liked}" class="${EB} hover:text-magenta-500 ${p.liked ? 'text-magenta-500' : 'text-secondary'}" type="button">${pill(p.liked ? 'icon-heart-filled' : 'icon-heart', c.like)}</button></div>`
      + `<div class="min-w-0 flex-1" data-engagement-action="generic"><button aria-label="View count" class="${EB} hover:text-brand text-secondary" type="button">${pill('icon-bar-chart', c.view)}</button></div>`
      + `<div class="flex shrink-0 items-center"><div class="@max-[290px]:hidden"><span class="contents" data-engagement-action="bookmark"><button aria-label="Bookmark" aria-pressed="${p.bookmarked}" class="${EB} hover:text-brand ${p.bookmarked ? 'text-brand' : 'text-secondary'}" type="button">${pill(p.bookmarked ? 'icon-bookmark-filled' : 'icon-bookmark')}</button></span></div>`
      + `<button data-engagement-action="share" type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" data-slot="xds-menu-trigger" aria-label="Share" class="${EB} hover:text-brand text-secondary">${pill('icon-share-ios')}</button></div></div>`;
  }
  const THREAD_LINE = '<div class="w-0.5 grow bg-(--x-border-normal) mt-1 -mb-3"></div>';
  function articleHTML(p, o) {
    o = o || {};
    const u = getUser(p.author);
    const href = `/${u.handle}/status/${p.id}`;
    let ctx = '';
    if (p.repostedBy) {
      const r = getUser(p.repostedBy);
      ctx = `<div class="flex items-center gap-2 text-subtext1 font-bold text-secondary"><div class="flex w-10 shrink-0 justify-end">${useIcon('icon-repost', 'size-4')}</div><a class="x-link hover:underline min-w-0 truncate" href="/${esc(r.handle)}"><span>${esc(r.handle === ME ? 'You' : r.name)} reposted</span></a></div>`;
    }
    const stamp = p.promoted
      ? '<span class="inline-flex w-fit shrink-0 whitespace-nowrap text-secondary"><span>Ad</span></span>'
      : o.focal ? '' : `<span class="inline-flex w-fit shrink-0 whitespace-nowrap"><a class="rounded-xs x-link hover:underline max-w-full text-body text-secondary inline-flex w-fit" href="${href}"><time datetime="${iso(p.time)}">${relTime(p.time)}</time></a></span>`;
    const header = `<div class="@container/post-actions flex items-start justify-between gap-2"><div class="x-middot-group max-w-full text-body font-normal text-secondary min-w-0"><div class="flex items-center gap-1 min-w-0"><span class="max-w-full min-w-0 flex shrink-0 items-center gap-1"><a class="rounded-xs x-link hover:underline max-w-full min-w-0" href="/${esc(u.handle)}"><div class="max-w-full text-body font-bold text-primary block truncate min-w-0" dir="auto">${esc(u.name)}</div></a>${badge(u)}</span><span class="flex max-w-full min-w-0 items-center gap-2"><a class="rounded-xs x-link max-w-full min-w-0" href="/${esc(u.handle)}"><span class="max-w-full text-body font-normal text-secondary line-clamp-1 wrap-break-word">@${esc(u.handle)}</span></a></span></div>${stamp}</div><div class="-me-[5px] flex shrink-0 items-center gap-1 whitespace-nowrap"><button data-slot="xds-menu-trigger" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-label="More" type="button" class="group x-button transition-colors h-8 w-8 min-w-8 px-0 hover:bg-btn-ghost-hover text-secondary hover:text-primary -my-2 shrink-0" style="border-radius:9999px"><span class="x-button-slot">${useIcon('icon-more-dots-hor', 'size-[18px]')}</span></button></div></div>`;
    const text = p.text ? `<div class="max-w-full ${o.focal ? 'text-[17px] leading-6' : 'text-body'} font-normal text-primary whitespace-pre-wrap wrap-anywhere" dir="auto" lang="en">${richText(p.text)}</div>` : '';
    const media = (p.video ? videoHTML(p) : photosHTML(p, u)) + quoteHTML(p.quote && POSTS.get(p.quote));
    const focalLine = o.focal ? `<div class="flex flex-wrap items-center gap-1 text-body text-secondary"><a class="rounded-xs x-link hover:underline" href="${href}"><time datetime="${iso(p.time)}">${fullTime(p.time)}</time></a><span aria-hidden="true">·</span><span><span class="font-bold text-primary">${fmt(p.counts.view)}</span> Views</span></div>` : '';
    return `<article class="flex flex-col gap-1">${ctx}<div class="flex gap-2"><div class="relative flex w-10 shrink-0 flex-col items-center self-stretch">${o.lineAbove ? '<div class="absolute -top-3 h-3 w-0.5 bg-(--x-border-normal)"></div>' : ''}<div data-post-avatar="true" class="relative z-10">${avatarLink(u, 'size-10')}</div>${o.lineBelow ? THREAD_LINE : ''}</div><div class="flex min-w-0 flex-1 flex-col gap-3"><div class="flex flex-col gap-0.5">${header}${text}</div><div class="flex flex-col gap-3 empty:hidden"><div class="flex flex-col gap-3 empty:hidden">${media}</div></div>${focalLine}${groupHTML(p)}</div></div></article>`;
  }
  function cellHTML(p, o) {
    o = o || {};
    const u = getUser(p.author);
    const href = `/${u.handle}/status/${p.id}`;
    const border = o.lineBelow ? 'border-b border-transparent' : 'border-b border-divider';
    if (o.focal) return `<li><div class="px-horizontal py-vertical ${border} relative">${articleHTML(p, o)}</div></li>`;
    return `<li><div role="link" data-href="${href}" tabindex="0" class="outline-focus transition-colors px-horizontal py-vertical ${border} cursor-pointer hover:bg-hover-faint relative" data-navigation-stop=""><a aria-hidden="true" class="absolute inset-0 pointer-events-none" href="${href}" tabindex="-1"></a>${articleHTML(p, o)}</div></li>`;
  }
  const timelineHTML = (id, cells, more) => `<div class="mx-auto w-full max-w-[var(--x-timeline-max-width,600px)]" id="${id}"><ul>${cells}</ul>${more ? spinner : ''}</div>`;

  function followBtn(u) {
    const on = isLoggedIn() && state.following.has(u.handle.toLowerCase());
    return `<button type="button" aria-label="${on ? 'Following' : 'Follow'} @${esc(u.handle)}" class="x-button x-follow">${on ? 'Following' : 'Follow'}</button>`;
  }
  function userRow(u, o) {
    o = o || {};
    return `<div class="${o.card ? 'x-card-row' : 'x-row'} flex items-start gap-3"><a class="x-link shrink-0" href="/${esc(u.handle)}">${avatar(u, 'size-10')}</a><div class="flex min-w-0 flex-1 flex-col"><div class="flex items-center justify-between gap-2"><div class="min-w-0"><a class="x-link flex min-w-0 items-center gap-1 hover:underline" href="/${esc(u.handle)}"><span class="truncate font-bold text-primary">${esc(u.name)}</span>${badge(u)}</a><a class="x-link block truncate text-secondary" href="/${esc(u.handle)}">@${esc(u.handle)}</a></div>${u.handle === ME ? '' : followBtn(u)}</div>${o.bio && u.bio ? `<div class="mt-1 text-body text-primary" dir="auto">${esc(u.bio)}</div>` : ''}</div></div>`;
  }
  function whoToFollowCell() {
    return `<li><div class="border-b border-divider"><div class="px-4 pt-3 pb-1"><h2 class="text-headline1 font-bold text-primary">Who to follow</h2></div>${['pixelpusher', 'typeface_daily', 'sunsetchaser'].map((h) => userRow(getUser(h), { card: true, bio: true })).join('')}<a class="x-link block x-card-row text-body text-brand" href="/i/connect_people">Show more</a></div></li>`;
  }
  function tabHTML(t, active) {
    const tag = t.href ? 'a' : 'button';
    return `<${tag} ${t.href ? `href="${esc(t.href)}"` : 'type="button"'} role="tab" aria-selected="${active}"${active ? ' data-active=""' : ''} data-orientation="horizontal" tabindex="${active ? 0 : -1}" class="x-tab relative flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap py-4 text-center text-body px-4 font-medium text-secondary data-active:text-primary hover:text-primary"><span class="relative inline-flex h-5 items-center justify-center">${esc(t.label)}<span aria-hidden="true" data-tab-underline="true" class="pointer-events-none invisible absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-(--x-fg-primary)"></span></span></${tag}>`;
  }
  function tablistHTML(tabs, active, o) {
    o = o || {};
    const inner = `<div class="flex items-stretch border-b border-normal"><div role="tablist" data-orientation="horizontal" class="x-tablist relative flex min-w-0 flex-1 items-stretch overflow-x-auto">${tabs.map((t, i) => tabHTML(t, i === active)).join('')}</div></div>`;
    return o.bare ? inner : `<div data-orientation="horizontal" class="bg-primary/80 sticky ${o.top || 'top-[53px]'} z-20 backdrop-blur-md">${inner}</div>`;
  }
  const backBtn = `<button type="button" class="hover:bg-hover-subtle flex h-[34px] w-[34px] items-center justify-center rounded-full transition-colors" aria-label="Back">${sicon('arrow-left', 'text-primary h-5 w-5')}</button>`;
  function pageHeader(title, o) {
    o = o || {};
    return `<div data-page-header="" class="bg-primary/80 sticky top-0 z-30 flex h-[53px] items-center gap-3 ${o.back ? 'px-2' : 'px-4'} backdrop-blur-md">${o.back ? backBtn : ''}<div class="flex min-w-0 flex-1 flex-col justify-center"><div class="flex min-w-0 items-center gap-1"><h2 class="truncate text-headline1 font-bold text-primary" dir="auto">${esc(title)}</h2>${o.badge || ''}</div>${o.sub ? `<div class="max-w-full text-subtext2 font-normal text-secondary">${esc(o.sub)}</div>` : ''}</div>${o.right || ''}</div>`;
  }
  function composerHTML(kind, o) {
    o = o || {};
    const me = getUser(ME);
    const tools = [['image', 'Add photos or video'], ['gif', 'Add a GIF'], ['poll', 'Add poll'], ['emoji', 'Add emoji'], ['calendar', 'Schedule post'], ['location', 'Tag location']]
      .map(([ic, label]) => `<button type="button" aria-label="${label}" class="x-iconbtn text-brand">${sicon(ic, 'size-5')}</button>`).join('');
    const attrs = `data-composer="${kind}"${o.replyTo ? ` data-reply-to="${esc(o.replyTo)}"` : ''}${o.quote ? ` data-quote="${esc(o.quote)}"` : ''}`;
    return `<div class="x-composer flex gap-2 ${kind === 'home' ? 'border-b border-normal px-4 pt-3 pb-2' : 'px-4 pb-3'}" ${attrs}><div class="w-10 shrink-0 pt-1">${avatarLink(me, 'size-10')}</div><div class="flex min-w-0 flex-1 flex-col"><div class="py-2"><div role="textbox" contenteditable="true" aria-label="Post text" aria-multiline="true" spellcheck="true" data-placeholder="${esc(o.placeholder || 'What’s happening?')}" class="x-editor text-[20px] leading-6 text-primary ${kind === 'modal' ? 'min-h-[120px]' : 'min-h-[28px]'}">${esc(o.text || '')}</div></div>${o.extra || ''}<div class="flex items-center justify-between gap-2 ${kind === 'home' ? '' : 'border-t border-normal'} pt-2"><div class="-ms-2 flex items-center">${tools}</div><button type="button"${o.text ? '' : ' disabled'} class="x-composer-submit x-button h-9 rounded-full bg-btn-primary px-4 text-body font-bold text-inverted hover:bg-btn-primary-hover">${esc(o.button || 'Post')}</button></div></div></div>`;
  }
  const sectionHTML = (title, body) => `<section class="overflow-hidden rounded-2xl border border-fg-alpha-06 bg-primary"><div class="flex items-center gap-2 ps-5 pe-3 pb-1.5 pt-4"><h2 class="max-w-full text-headline2 font-medium text-primary min-w-0 flex-1">${title}</h2></div>${body}</section>`;
  const searchForm = (value, o) => `<form role="search" aria-label="Search" action="/search" class="${(o && o.cls) || ''}"><label class="x-searchbox">${sicon('explore', 'size-[18px] shrink-0')}<input type="search" name="q" placeholder="Search" aria-label="Search query" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(value || '')}"></label></form>`;
  const trendRow = (t, cls) => `<a class="x-link block ${cls || 'x-card-row'}" href="/search?q=${encodeURIComponent(t.name)}&amp;src=trend_click"><div class="text-subtext1 text-secondary">${esc(t.cat)}</div><div class="mt-1 text-body font-bold text-primary" dir="auto">${esc(t.name)}</div><div class="mt-1 text-subtext1 text-secondary">${esc(t.posts)}</div></a>`;
  const listRow = (title, sub, href) => `<a class="x-link block x-row" href="${esc(href)}"><div class="text-body font-bold text-primary">${esc(title)}</div>${sub ? `<div class="mt-1 text-subtext1 text-secondary">${esc(sub)}</div>` : ''}</a>`;

  /* ------------------------------------------------------------------ shell */
  function navLink(href, label, icon, extra) {
    return `<a href="${href}" aria-label="${label}" class="x-link x-nav-item group"><div class="x-nav-pill"><div class="relative">${sicon(icon)}${extra || ''}</div><span class="x-nav-label">${label}</span></div></a>`;
  }
  function leftNavIn() {
    const me = getUser(ME);
    return `<div class="flex h-full flex-col"><div class="flex flex-col pt-1"><a aria-label="X" class="x-link hover:bg-btn-ghost-hover ms-[12px] flex size-[50px] shrink-0 cursor-pointer items-center justify-center rounded-full" href="/home">${logo('size-[30px]')}</a>`
      + `<nav aria-label="Primary" role="navigation" class="flex flex-col gap-0.5 pt-1">`
      + navLink('/home', 'Home', 'home') + navLink('/explore', 'Explore', 'explore')
      + navLink('/notifications', 'Notifications', 'notifications', state.unread ? `<div aria-label="${state.unread} unread items" class="x-nav-badge">${state.unread}</div>` : '')
      + navLink('/i/chat', 'Messages', 'messages') + navLink('/i/grok', 'Grok', 'grok') + navLink('/i/bookmarks', 'Bookmarks', 'bookmarks')
      + navLink(`/${ME}/communities`, 'Communities', 'communities') + navLink('/i/premium_sign_up', 'Premium', 'premium') + navLink(`/${ME}`, 'Profile', 'profile')
      + `<button type="button" aria-label="More menu items" aria-haspopup="menu" aria-expanded="false" class="x-nav-item group"><div class="x-nav-pill">${sicon('more')}<span class="x-nav-label">More</span></div></button></nav>`
      + `<a href="/compose/post" aria-label="Post" class="x-link x-post-btn"><span class="x-post-label">Post</span><span class="x-narrow-only">${sicon('feather', 'size-6')}</span></a></div>`
      + `<div class="mt-auto"><button type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded="false" class="x-account-btn">${avatar(me, 'size-10')}<div class="x-wide-only min-w-0 flex-1 flex-col"><span class="truncate text-body font-bold text-primary">${esc(me.name)}</span><span class="truncate text-body text-secondary">@${ME}</span></div><span class="x-wide-only text-primary">${useIcon('icon-more-dots-hor', 'size-[18px]')}</span></button></div></div>`;
  }
  const leftNavOut = () => `<div class="flex flex-col pt-1"><a aria-label="X" class="x-link hover:bg-btn-ghost-hover ms-[12px] flex size-[50px] shrink-0 cursor-pointer items-center justify-center rounded-full" href="/">${logo('size-[30px]')}</a></div>`;
  function footerNav() {
    const links = [['Terms of Service', '/tos'], ['Privacy Policy', '/privacy'], ['Cookie Policy', '/cookies'], ['Accessibility', '/accessibility'], ['Ads info', '/ads-info']];
    return `<nav class="flex flex-wrap items-center gap-y-1 px-4 py-3" aria-label="Footer">${links.map(([t, h]) => `<span class="flex items-center"><a href="${h}" class="rounded-xs x-link hover:underline max-w-full text-subtext3 text-secondary inline-flex min-h-6 items-center leading-6">${t}</a><span class="max-w-full text-subtext3 font-normal text-secondary px-1 select-none" aria-hidden="true">·</span></span>`).join('')}<span class="text-subtext3 text-secondary">© 2026 X Corp.</span></nav>`;
  }
  function asideIn() {
    return `<div class="h-full w-full"><div></div><div class="x-aside-sticky sticky top-0 flex w-full flex-col gap-4 px-6 py-3">`
      + searchForm('', { cls: 'pb-1' })
      + sectionHTML('Subscribe to Premium', `<div class="flex flex-col gap-3 px-5 pb-4"><p class="text-secondary text-[15px] leading-5">Subscribe to unlock new features and if eligible, receive a share of revenue.</p><div><button type="button" class="x-button h-9 bg-brand px-4 text-body text-white" data-premium-cta="">Subscribe</button></div></div>`)
      + sectionHTML('What’s happening', `<div class="flex flex-col">${TRENDS.slice(0, 5).map((t) => trendRow(t)).join('')}<a class="x-link block x-card-row text-body text-brand" href="/explore/tabs/trending">Show more</a></div>`)
      + sectionHTML('Who to follow', `<div class="flex flex-col">${['tidepool_', 'ferris_fan', 'nightowl_42'].map((h) => userRow(getUser(h), { card: true })).join('')}<a class="x-link block x-card-row text-body text-brand" href="/i/connect_people">Show more</a></div>`)
      + footerNav() + '</div></div>';
  }
  const loginHref = (mode) => `/i/jf/onboarding/web?mode=${mode}&redirect_after_login=${encodeURIComponent(location.pathname)}`;
  function asideOut() {
    return `<div class="h-full w-full"><div></div><div class="x-aside-sticky sticky top-0 flex w-full flex-col gap-4 px-6 py-3">`
      + sectionHTML('Log in or sign up for X', `<div class="flex flex-col gap-3 px-5 pb-4"><p class="text-secondary text-[15px] leading-5">See what’s happening and join the conversation</p><div class="flex flex-col gap-3"><a class="x-link x-button h-10 bg-btn-primary px-3 text-[14px] text-inverted" href="${esc(loginHref('signup'))}">Continue with phone</a><button type="button" disabled="" aria-label="Continue with Apple" class="x-button h-10 border border-normal px-3 text-[14px] text-primary">Continue with Apple</button><a class="x-link x-button h-10 border border-normal px-3 text-[14px] text-primary" href="${esc(loginHref('login'))}">Log in with username or email</a></div></div>`)
      + footerNav() + '</div></div>';
  }
  function loggedOutTopChrome() {
    return `<div class="sticky top-0 z-30 lg:hidden"><div data-top-chrome="" class="bg-primary/80 backdrop-blur-md"><div class="flex h-[53px] items-center gap-3 px-4"><a aria-label="X" class="x-link flex size-8 items-center justify-center sm:hidden" href="/">${logo('text-primary size-6')}</a><div class="ms-auto flex shrink-0 items-center gap-1"><a class="x-link text-primary hover:bg-hover-subtle flex h-8 items-center justify-center rounded-full border border-transparent px-3 text-[14px] font-bold" data-interaction="mobile-top-bar-log-in" href="${esc(loginHref('login'))}">Log in</a><a class="x-link flex h-8 items-center justify-center rounded-full bg-btn-primary px-4 text-[14px] font-bold text-inverted" href="${esc(loginHref('signup'))}">Sign up</a></div></div></div></div>`;
  }
  function ensureShell() {
    const mode = isLoggedIn() ? 'in' : 'out';
    if (shell && shell.mode === mode) return;
    if (shell) shell.root.remove();
    const root = document.createElement('div');
    root.className = 'x-root mx-auto flex min-h-(--x-page-height) w-full max-w-[1024px] flex-col overflow-x-clip [--x-main-column-width:600px] [--x-sidebar-wide:0] xl:max-w-[1280px] xl:[--x-sidebar-wide:1]';
    root.innerHTML = `<div class="flex w-full grow justify-center"><div class="hidden sm:block"><div class="x-sidebar sticky top-(--safe-area-top) flex h-(--x-page-height,100dvh) w-[calc(72px+184px*var(--x-sidebar-expanded,0))] shrink-0 flex-col overflow-hidden [--x-sidebar-expanded:calc(var(--x-sidebar-wide,0)*var(--x-sidebar-open))] [--x-sidebar-open:1]">${mode === 'in' ? leftNavIn() : leftNavOut()}</div></div><div class="min-w-0 flex-1 max-lg:max-w-(--x-main-column-width) grid grid-cols-1 lg:grid-cols-[var(--x-main-column-width)_minmax(0,1fr)]"><main class="border-normal mx-auto flex h-auto w-full max-w-(--x-main-column-width) min-w-0 flex-col sm:border-x"></main><aside class="outline-focus hidden flex-col lg:flex">${mode === 'in' ? asideIn() : asideOut()}</aside></div></div>`;
    const sprite = document.body.querySelector(':scope > svg');
    document.body.insertBefore(root, sprite ? sprite.nextSibling : document.body.firstChild);
    shell = { mode, root, main: root.querySelector('main'), aside: root.querySelector('aside'), grid: root.querySelector('main').parentElement };
    state.renderedKey = null;
  }
  function positionAside() {
    if (!shell || !shell.aside.isConnected) return;
    const s = shell.aside.querySelector('.x-aside-sticky');
    if (s) s.style.top = Math.min(0, innerHeight - s.offsetHeight) + 'px';
  }

  /* ------------------------------------------------------------------ pages */
  const mobileTopRow = () => `<div class="flex h-[53px] items-center px-4 sm:hidden">${avatarLink(getUser(ME), 'size-8')}<div class="flex flex-1 justify-center">${logo('size-6 text-primary')}</div><div class="w-8"></div></div>`;
  function forYouCells() {
    let html = state.myPosts.map((p) => cellHTML(p)).join('');
    for (let i = 0; i < state.homeCount; i++) { html += cellHTML(homePost(i)); if (i === 4) html += whoToFollowCell(); }
    return html;
  }
  function homePage() {
    if (!isLoggedIn()) {
      return { title: 'X. It’s what’s happening / X', html: pageHeader('Home') + timelineHTML('urt:home:for-you', forYouCells(), state.homeCount < 50), kind: 'home' };
    }
    const following = state.homeTab === 'following';
    const header = `<div class="bg-primary/80 sticky top-0 z-30 backdrop-blur-md">${mobileTopRow()}${tablistHTML([{ label: 'For you' }, { label: 'Following' }], following ? 1 : 0, { bare: true })}</div>`;
    const cells = following ? Array.from({ length: 12 }, (_, i) => cellHTML(followingPost(i))).join('') : forYouCells();
    return { title: 'Home / X', kind: 'home', html: header + composerHTML('home') + timelineHTML(following ? 'urt:home:following' : 'urt:home:for-you', cells, !following && state.homeCount < 50) };
  }
  function explorePage(tab) {
    const tabs = [['for-you', 'For You'], ['trending', 'Trending'], ['news', 'News'], ['sports', 'Sports']];
    const idx = Math.max(0, tabs.findIndex(([k]) => k === tab));
    const key = tabs[idx][0];
    const list = key === 'for-you' ? TRENDS : key === 'trending' ? TRENDS.filter((t) => t.tab === 'trending').concat(TRENDS.slice(0, 3)) : TRENDS.filter((t) => t.tab === key);
    const header = `<div class="bg-primary/80 sticky top-0 z-30 backdrop-blur-md"><div class="flex h-[53px] items-center gap-2 px-4">${searchForm('', { cls: 'min-w-0 flex-1' })}<a class="x-link x-iconbtn" aria-label="Settings" href="/settings/explore">${sicon('settings', 'size-5')}</a></div>${tablistHTML(tabs.map(([k, label]) => ({ label, href: k === 'for-you' ? '/explore' : `/explore/tabs/${k}` })), idx, { bare: true })}</div>`;
    return { title: 'Explore / X', aside: false, html: header + `<div>${list.map((t) => trendRow(t, 'x-row')).join('')}</div>` };
  }
  function searchPage(q, f) {
    const tabs = [['', 'Top'], ['live', 'Latest'], ['user', 'People'], ['media', 'Media']];
    const idx = Math.max(0, tabs.findIndex(([k]) => k === (f || '')));
    const header = `<div class="bg-primary/80 sticky top-0 z-30 backdrop-blur-md"><div class="flex h-[53px] items-center gap-2 px-2">${backBtn}${searchForm(q, { cls: 'min-w-0 flex-1' })}</div>${tablistHTML(tabs.map(([k, label]) => ({ label, href: `/search?q=${encodeURIComponent(q)}&src=typed_query${k ? `&f=${k}` : ''}` })), idx, { bare: true })}</div>`;
    let body;
    if (!q) body = '<div class="px-8 py-8 text-center text-secondary">Try searching for people, lists, or keywords</div>';
    else if (f === 'user') {
      const ql = q.toLowerCase().replace(/^[@#]/, '');
      let users = USER_DEFS.map(([h]) => getUser(h)).filter((u) => u.handle !== ME && (u.handle.toLowerCase().includes(ql) || u.name.toLowerCase().includes(ql)));
      if (!users.length) users = ['quietcoder', 'designnotes', 'mountainlight'].map(getUser);
      body = users.map((u) => userRow(u, { bio: true })).join('');
    } else {
      let posts = searchPosts(q, f === 'live');
      if (f === 'media') posts = posts.filter((p) => p.media.length).concat(profilePosts('mountainlight').filter((p) => p.media.length).slice(0, 3));
      body = timelineHTML('urt:search', posts.map((p) => cellHTML(p)).join(''), false);
    }
    return { title: `${q} - Search / X`, html: header + body };
  }
  function notificationsPage(tab) {
    const tabs = [['', 'All', '/notifications'], ['verified', 'Verified', '/notifications/verified'], ['mentions', 'Mentions', '/notifications/mentions']];
    const idx = Math.max(0, tabs.findIndex(([k]) => k === (tab || '')));
    const mine = profilePosts(ME);
    const row = (icon, color, users, verb, post, href) => `<li><div role="link" tabindex="0" data-href="${href}" class="outline-focus transition-colors px-horizontal py-vertical border-b border-divider cursor-pointer hover:bg-hover-faint relative"><div class="flex gap-2"><div class="flex w-10 shrink-0 justify-end ${color}">${icon}</div><div class="flex min-w-0 flex-1 flex-col gap-2"><div class="flex gap-1">${users.map((u) => avatarLink(u, 'size-8')).join('')}</div><div class="text-body text-primary"><a class="x-link font-bold hover:underline" href="/${users[0].handle}">${esc(users[0].name)}</a>${users.length > 1 ? ` and ${users.length - 1} other${users.length > 2 ? 's' : ''}` : ''} ${verb}</div>${post ? `<div class="text-body text-secondary line-clamp-2" dir="auto">${esc(post.text)}</div>` : ''}</div></div></div></li>`;
    const heart = useIcon('icon-heart-filled', 'size-7');
    const rep = useIcon('icon-repost', 'size-7');
    const person = sicon('person', 'size-7');
    const items = [
      { v: true, html: row(heart, 'text-magenta-500', [getUser('designnotes'), getUser('pixelpusher'), getUser('quietcoder')], 'liked your post', mine[0], `/${ME}/status/${mine[0].id}`) },
      { v: false, html: row(person, 'text-brand', [getUser('tidepool_')], 'followed you', null, '/tidepool_') },
      { m: true, v: true, html: cellHTML(MENTIONS[0]) },
      { v: true, html: row(rep, 'text-green-500', [getUser('mountainlight')], 'reposted your post', mine[1], `/${ME}/status/${mine[1].id}`) },
      { v: false, html: row(heart, 'text-magenta-500', [getUser('ferris_fan')], 'liked your reply', mine[2], `/${ME}/status/${mine[2].id}`) },
      { m: true, v: true, html: cellHTML(MENTIONS[1]) },
      { v: false, html: row(person, 'text-brand', [getUser('nightowl_42'), getUser('sunsetchaser')], 'followed you', null, '/nightowl_42') },
      { m: true, v: false, html: cellHTML(MENTIONS[2]) },
    ];
    const shown = items.filter((it) => (idx === 1 ? it.v : idx === 2 ? it.m : true));
    const header = `<div class="bg-primary/80 sticky top-0 z-30 backdrop-blur-md"><div class="flex h-[53px] items-center px-4"><h2 class="flex-1 text-headline1 font-bold text-primary">Notifications</h2><a class="x-link x-iconbtn" aria-label="Settings" href="/settings/notifications">${sicon('settings', 'size-5')}</a></div>${tablistHTML(tabs.map(([, label, href]) => ({ label, href })), idx, { bare: true })}</div>`;
    return { title: 'Notifications / X', kind: 'notifications', html: header + `<div class="mx-auto w-full" id="urt:notifications"><ul>${shown.map((it) => it.html).join('')}</ul></div>` };
  }
  function bubble(mine, text) {
    return `<div class="flex ${mine ? 'justify-end' : 'justify-start'}"><div class="max-w-[75%] rounded-3xl px-4 py-2 text-body ${mine ? 'bg-brand text-white rounded-br-md' : 'bg-tertiary text-primary rounded-bl-md'}" dir="auto">${esc(text)}</div></div>`;
  }
  function chatPage(id) {
    const conv = id ? CONVOS.find((c) => c.id === id) : null;
    const rows = CONVOS.map((c) => {
      const u = getUser(c.with);
      const last = c.msgs[c.msgs.length - 1];
      return `<a href="/i/chat/${c.id}" class="x-link flex gap-3 px-4 py-3 transition-colors hover:bg-hover-faint${conv === c ? ' bg-secondary' : ''}">${avatar(u, 'size-10')}<div class="min-w-0 flex-1"><div class="flex min-w-0 items-center gap-1 text-body"><span class="truncate font-bold text-primary">${esc(u.name)}</span>${badge(u)}<span class="truncate text-secondary">@${esc(u.handle)}</span><span class="text-secondary">·</span><span class="whitespace-nowrap text-secondary">${c.time}</span></div><div class="truncate text-body text-secondary">${last[0] ? 'You: ' : ''}${esc(last[1])}</div></div></a>`;
    }).join('');
    let right;
    if (conv) {
      const u = getUser(conv.with);
      right = `<div class="flex h-[53px] shrink-0 items-center gap-3 border-b border-normal px-4"><a class="x-link x-iconbtn md:hidden" aria-label="Back to chats" href="/i/chat">${sicon('arrow-left', 'size-5')}</a>${avatarLink(u, 'size-8')}<div class="min-w-0 flex-1"><div class="truncate font-bold text-primary">${esc(u.name)}</div><div class="truncate text-subtext2 text-secondary">@${esc(u.handle)}</div></div></div>`
        + `<div class="x-messages flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">${conv.msgs.map(([m, t]) => bubble(!!m, t)).join('')}</div>`
        + `<div class="x-composer shrink-0 border-t border-normal px-3 py-2" data-composer="chat" data-conversation="${conv.id}"><div class="flex items-end gap-2 rounded-3xl bg-secondary px-3 py-1.5"><div role="textbox" contenteditable="true" aria-label="Message" aria-multiline="true" data-placeholder="Start a new message" class="x-editor min-h-6 flex-1 py-1 text-body text-primary"></div><button type="button" aria-label="Send" disabled class="x-composer-submit x-button size-8 text-brand">${sicon('send', 'size-5')}</button></div></div>`;
    } else {
      right = `<div class="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center"><h2 class="text-title4 font-extrabold text-primary">Select a message</h2><p class="text-body text-secondary">Choose from your existing conversations, start a new one, or just keep swimming.</p><a class="x-link x-button mt-3 h-12 bg-brand px-8 text-body text-white" href="/i/chat/${CONVOS[0].id}">New chat</a></div>`;
    }
    const html = `<div class="x-chat flex"><section aria-label="Conversations" class="${conv ? 'max-md:hidden ' : ''}flex w-full shrink-0 flex-col border-e border-normal md:w-[380px]"><div class="flex h-[53px] items-center justify-between px-4"><h2 class="text-headline1 font-bold text-primary">Chat</h2><div class="flex gap-1"><a class="x-link x-iconbtn" aria-label="Settings" href="/settings/direct_messages">${sicon('settings', 'size-5')}</a><a class="x-link x-iconbtn" aria-label="New chat" href="/i/chat/${CONVOS[0].id}">${sicon('plus', 'size-5')}</a></div></div><div class="px-4 pb-2"><label class="x-searchbox h-10">${sicon('explore', 'size-4 shrink-0')}<input type="text" placeholder="Search" aria-label="Search chats"></label></div><div class="flex-1 overflow-y-auto">${rows}</div></section><section aria-label="Conversation" class="${conv ? '' : 'max-md:hidden '}flex min-w-0 flex-1 flex-col">${right}</section></div>`;
    return { title: conv ? `${getUser(conv.with).name} / Chat / X` : 'Chat / X', aside: false, wide: true, html, after: (main) => { const m = main.querySelector('.x-messages'); if (m) m.scrollTop = m.scrollHeight; } };
  }
  function bookmarksPage() {
    const cells = Array.from({ length: 8 }, (_, i) => cellHTML(bookmarkPost(i))).join('');
    return { title: 'Bookmarks / X', html: pageHeader('Bookmarks', { back: true, sub: `@${ME}` }) + timelineHTML('urt:bookmarks', cells, false) };
  }
  function profilePage(handle, tab) {
    const u = getUser(handle);
    const isMe = u.handle.toLowerCase() === ME;
    const base = `/${u.handle}`;
    const tabs = [['', 'Posts'], ['with_replies', 'Replies'], ['highlights', 'Highlights'], ['media', 'Media'], ['likes', 'Likes']];
    const idx = Math.max(0, tabs.findIndex(([k]) => k === (tab || '')));
    let posts = profilePosts(u.handle);
    if (isMe) posts = state.myPosts.concat(posts);
    if (idx === 1) posts = posts.filter((_, i) => i % 2 === 0);
    if (idx === 2) posts = posts.slice(0, 3);
    if (idx === 3) posts = posts.filter((p) => p.media.length || p.video);
    if (idx === 4) posts = isMe ? [homePost(1), homePost(2), homePost(7), followingPost(2), bookmarkPost(1)] : [];
    const buttons = isMe
      ? `<a class="x-link x-button h-9 border border-normal px-4 text-body text-primary" href="/settings/profile">Edit profile</a>`
      : `<a class="x-link x-iconbtn border border-normal" aria-label="Message" href="/i/chat">${sicon('messages', 'size-5')}</a>${followBtn(u).replace('x-follow', 'x-follow h-9')}`;
    const meta = [u.loc && `<div class="flex items-center gap-1">${sicon('location', 'size-[18px]')}<span>${esc(u.loc)}</span></div>`, `<div class="flex items-center gap-1">${sicon('calendar', 'size-[18px]')}<a class="x-link hover:underline" href="${base}/about">Joined ${esc(u.joined)}</a></div>`].filter(Boolean).join('');
    const head = `<a class="x-link block" aria-label="Opens header photo" href="${base}/header_photo"><div class="bg-tertiary overflow-hidden aspect-[3/1]"><img width="1500" height="500" alt="${esc(u.name)} profile banner" class="size-full object-cover" decoding="async" src="${esc(u.banner)}"></div></a>`
      + `<div class="flex flex-col"><div class="mb-4 flex flex-col gap-3 px-4"><div class="x-profile-top"><a class="x-link x-profile-avatar block" aria-label="Opens profile photo" href="${base}/photo">${avatar(u, 'size-full border-4 border-primary', '400x400')}</a>${buttons}</div>`
      + `<div class="min-w-0 flex flex-col items-start"><span class="flex max-w-full min-w-0 items-center gap-1"><h1 class="max-w-full text-headline1 font-bold text-primary wrap-break-word min-w-0" dir="auto">${esc(u.name)}</h1>${badge(u, 'size-5')}</span><span class="max-w-full text-body font-normal text-secondary">@${esc(u.handle)}</span></div>`
      + (u.bio ? `<div class="max-w-full text-body font-normal text-primary whitespace-pre-wrap wrap-anywhere" dir="auto">${richText(u.bio)}</div>` : '')
      + `<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-secondary">${meta}</div>`
      + `<div class="flex flex-wrap items-center gap-x-5"><a class="x-link hover:underline" href="${base}/following"><span class="text-subtext1 font-bold text-primary">${fmt(u.following)}</span> <span class="text-subtext1 text-secondary">Following</span></a><a class="x-link hover:underline" href="${base}/verified_followers"><span class="text-subtext1 font-bold text-primary">${fmt(u.followers)}</span> <span class="text-subtext1 text-secondary">Followers</span></a></div></div></div>`;
    const tl = tablistHTML(tabs.map(([k, label]) => ({ label, href: k ? `${base}/${k}` : base })), idx);
    const body = posts.length ? timelineHTML(`urt:profile:${u.handle.toLowerCase()}`, posts.map((p) => cellHTML(p)).join(''), false)
      : `<div class="px-8 py-8 text-center"><div class="text-title4 font-extrabold text-primary">${idx === 4 ? `@${esc(u.handle)}’s likes are private` : 'Nothing to see here — yet'}</div></div>`;
    return { title: `${u.name} (@${u.handle}) / X`, html: pageHeader(u.name, { back: true, sub: `${fmt(u.posts)} posts`, badge: badge(u) }) + head + tl + body };
  }
  function followListPage(handle, which) {
    const u = getUser(handle);
    const tabs = [['verified_followers', 'Verified Followers'], ['followers', 'Followers'], ['following', 'Following']];
    const idx = Math.max(0, tabs.findIndex(([k]) => k === which));
    const pool = USER_DEFS.map(([h]) => getUser(h)).filter((x) => x.handle !== u.handle && x.handle !== ME);
    const list = idx === 0 ? pool.filter((x) => x.verified) : idx === 1 ? pool.slice(4) : pool.filter((x) => state.following.has(x.handle.toLowerCase()) || x.handle.length % 2);
    return { title: `People ${idx === 2 ? 'followed by' : 'following'} ${u.name} (@${u.handle}) / X`, html: pageHeader(u.name, { back: true, sub: `@${u.handle}` }) + tablistHTML(tabs.map(([k, label]) => ({ label, href: `/${u.handle}/${k}` })), idx) + list.map((x) => userRow(x, { bio: true })).join('') };
  }
  function statusPage(handle, id) {
    const p = getPostFor(id, handle);
    const u = getUser(p.author);
    const replies = repliesFor(p);
    const extra = (state.extraReplies[p.id] || []).map((r) => cellHTML(r)).join('');
    const cells = cellHTML(p, { focal: true, lineBelow: true })
      + cellHTML(replies[0], { lineAbove: true, lineBelow: true })
      + cellHTML(replies[1], { lineAbove: true })
      + extra + replies.slice(2).map((r) => cellHTML(r)).join('');
    const text = p.text.length > 120 ? p.text.slice(0, 119) + '…' : p.text;
    return { title: `${u.name} on X: "${text}" / X`, kind: 'status', statusId: p.id, html: pageHeader('Post', { back: true }) + timelineHTML(`urt:conversation:${p.id}`, cells, false) };
  }
  function simplePage(title, rows, o) {
    o = o || {};
    return { title: `${o.docTitle || title} / X`, html: pageHeader(title, { back: o.back !== false, sub: o.sub }) + (o.intro || '') + rows.map(([t, s, h]) => listRow(t, s, h || '#')).join('') };
  }
  const SETTINGS = {
    account: 'Your account', security_and_account_access: 'Security and account access', privacy_and_safety: 'Privacy and safety', notifications: 'Notifications',
    accessibility_display_and_languages: 'Accessibility, display, and languages', display: 'Display', profile: 'Edit profile', explore: 'Explore settings', direct_messages: 'Direct Messages', premium: 'Premium',
  };
  function notFound() {
    return { title: 'Page not found / X', html: pageHeader('', { back: true }) + '<div class="flex flex-col items-center gap-5 px-8 py-8 text-center"><div class="text-body text-secondary">Hmm...this page doesn’t exist. Try searching for something else.</div><a class="x-link x-button h-9 bg-brand px-4 text-body text-white" href="/explore">Search</a></div>' };
  }
  const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'search', 'settings', 'compose', 'hashtag', 'login', 'logout', 'signup', 'tos', 'privacy', 'cookies', 'accessibility', 'ads-info', 'about', 'jobs', 'account', 'intent', 'share']);
  function pageFor(path, q) {
    let m;
    if (path === '/' || path === '/home') return homePage();
    if (path === '/explore') return explorePage('for-you');
    if ((m = path.match(/^\/explore\/tabs\/([\w-]+)$/))) return explorePage(m[1]);
    if (path === '/search') return searchPage((q.get('q') || '').trim(), q.get('f') || '');
    if ((m = path.match(/^\/hashtag\/([^/]+)$/))) return searchPage('#' + decodeURIComponent(m[1]), q.get('f') || '');
    if (path === '/notifications') return notificationsPage('');
    if ((m = path.match(/^\/notifications\/(verified|mentions)$/))) return notificationsPage(m[1]);
    if (path === '/i/chat') return chatPage(null);
    if ((m = path.match(/^\/i\/chat\/([\w-]+)$/))) return chatPage(m[1]);
    if (path === '/i/bookmarks') return bookmarksPage();
    if (path === '/i/grok') return simplePage('Grok', [['Explain this post', 'Get context on anything you see'], ['Create images', 'Describe what you want to see'], ['Latest news', 'What’s happening right now'], ['Help me write', 'Draft a post or reply']], { back: false, intro: '<div class="px-4 py-4"><div class="x-searchbox"><input type="text" placeholder="Ask anything" aria-label="Ask Grok anything"></div></div>' });
    if (path === '/i/premium_sign_up') return simplePage('Premium', [['Basic', '$3/month · Small reply boost, edit post, longer posts'], ['Premium', '$8/month · Half ads in For You, larger reply boost, Grok'], ['Premium+', '$40/month · No ads, largest reply boost, highest Grok limits']], { intro: '<div class="px-4 py-6 text-center"><div class="text-title4 font-extrabold text-primary">Upgrade to Premium</div><div class="mt-2 text-body text-secondary">Enjoy an enhanced experience, exclusive creator tools, top-tier verification and security.</div></div>' });
    if (path === '/i/connect_people') return { title: 'Connect / X', html: pageHeader('Connect', { back: true }) + '<div class="px-4 pt-3 pb-1"><h2 class="text-headline1 font-bold text-primary">Suggested for you</h2></div>' + ['pixelpusher', 'typeface_daily', 'sunsetchaser', 'tidepool_', 'ferris_fan', 'nightowl_42'].map((h) => userRow(getUser(h), { bio: true })).join('') };
    if (path === '/i/lists') return simplePage('Lists', [['Space news', '12 members'], ['Design people', '48 members'], ['Photographers', '31 members']]);
    if (path === '/i/monetization') return simplePage('Monetization', [['Subscriptions', 'Let followers support you'], ['Creator revenue sharing', 'Earn from ads in replies']]);
    if (path === '/settings') return simplePage('Settings', Object.keys(SETTINGS).slice(0, 5).map((k) => [SETTINGS[k], '', `/settings/${k}`]), { back: false });
    if ((m = path.match(/^\/settings\/([\w-]+)/))) return simplePage(SETTINGS[m[1]] || 'Settings', [['Account information', 'See your account information like your phone number and email address.'], ['Change your password', 'Change your password at any time.'], ['Download an archive of your data', 'Get insights into the type of information stored for your account.']]);
    if (path === '/tos' || path === '/privacy' || path === '/cookies' || path === '/accessibility' || path === '/ads-info') {
      const t = { '/tos': 'Terms of Service', '/privacy': 'Privacy Policy', '/cookies': 'Cookie Policy', '/accessibility': 'Accessibility', '/ads-info': 'Ads info' }[path];
      return simplePage(t, [['Overview', 'The short version'], ['Details', 'The long version']]);
    }
    if ((m = path.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(.*))?$/)) && !RESERVED.has(m[1].toLowerCase())) {
      const handle = getUser(m[1]).handle;
      const rest = m[2] || '';
      let s;
      if (!rest || ['with_replies', 'highlights', 'media', 'likes'].includes(rest)) return profilePage(handle, rest);
      if (['following', 'followers', 'verified_followers'].includes(rest)) return followListPage(handle, rest);
      if (rest === 'lists') return simplePage('Lists', [['Your Lists', 'You haven’t created or followed any Lists.'], ['Discover new Lists', 'Space news · Design people · Photographers', '/i/lists']], { sub: `@${handle}` });
      if (rest === 'communities') return simplePage('Communities', [['Build in Public', '128K members'], ['Astrophotography', '64K members'], ['Typography', '21K members']], { sub: `@${handle}` });
      if (rest === 'about') return simplePage('About this account', [['Date joined', getUser(handle).joined], ['Account based in', getUser(handle).loc || 'United States']]);
      if ((s = rest.match(/^status\/(\d+)$/))) return statusPage(handle, s[1]);
    }
    return notFound();
  }

  /* ------------------------------------------------------------------ router */
  function redirectFor(path, q) {
    if (path === '/' && isLoggedIn()) return '/home';
    if (path === '/messages' || path.startsWith('/messages/')) return '/i/chat';
    if (path === '/logout') { store.set('mockx:loggedout', '1'); return '/'; }
    if (path === '/i/jf/onboarding/web' || path === '/login' || path === '/i/flow/login' || path === '/i/flow/signup') {
      store.set('mockx:loggedout', '0');
      const r = q.get('redirect_after_login');
      return r && r.startsWith('/') && r !== '/' ? r : '/home';
    }
    return null;
  }
  function resolveModal(path) {
    let m;
    if (path === '/compose/post' || path === '/compose/tweet') return { modal: 'compose' };
    if ((m = path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/(?:photo|video)\/(\d)$/))) return { modal: 'photo', bg: `/${m[1]}/status/${m[2]}`, handle: m[1], id: m[2], n: +m[3] };
    if ((m = path.match(/^\/([A-Za-z0-9_]{1,15})\/(photo|header_photo)$/)) && !RESERVED.has(m[1].toLowerCase())) return { modal: 'avatar', bg: `/${m[1]}`, handle: m[1], which: m[2] };
    return null;
  }
  function renderPage(key) {
    const u = new URL(key, location.origin);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    const pg = pageFor(path, u.searchParams);
    const main = shell.main;
    main.innerHTML = (isLoggedIn() ? '' : loggedOutTopChrome()) + pg.html;
    if (pg.aside === false) shell.aside.remove();
    else if (!shell.aside.isConnected) shell.grid.appendChild(shell.aside);
    main.classList.toggle('x-wide', !!pg.wide);
    state.renderedKey = key;
    state.pageTitle = pg.title;
    state.page = pg;
    document.querySelectorAll('a[href^="/i/jf/onboarding/web"]').forEach((a) => { a.setAttribute('href', loginHref(new URL(a.href).searchParams.get('mode') || 'login')); });
    if (pg.kind === 'notifications' && state.unread) {
      state.unread = 0;
      const b = shell.root.querySelector('nav[aria-label="Primary"] [aria-label$="unread items"]');
      if (b) b.remove();
    }
    if (pg.after) pg.after(main);
    positionAside();
    return true;
  }
  function render(opts) {
    opts = opts || {};
    syncParams();
    let url = new URL(location.href);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    for (let guard = 0, r; guard < 5 && (r = redirectFor(path, url.searchParams)); guard++) {
      history.replaceState({ i: state.hist }, '', r);
      url = new URL(location.href);
      path = url.pathname.replace(/\/+$/, '') || '/';
    }
    window.__mockXRenders++;
    closeMenu();
    ensureShell();
    const md = resolveModal(path);
    let rendered = false;
    if (md) {
      const bg = md.modal === 'compose' ? state.renderedKey || '/home' : md.bg;
      if (state.renderedKey !== bg) rendered = renderPage(bg);
      openRouteModal(md, url.searchParams, bg);
      document.title = md.modal === 'compose' ? 'Compose new post / X' : state.pageTitle;
    } else {
      closeModal();
      const key = path + url.search;
      if (opts.force || state.renderedKey !== key) rendered = renderPage(key);
      document.title = state.pageTitle;
    }
    if (rendered) window.scrollTo(0, opts.restore ? state.scroll[state.hist] || 0 : 0);
    markActive();
    setTimeout(maybeLoadMore, 0);
  }
  function navigate(href, o) {
    o = o || {};
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) { location.href = u.href; return; }
    const target = u.pathname + u.search + u.hash;
    if (o.replace) history.replaceState({ i: state.hist }, '', target);
    else { state.scroll[state.hist] = window.scrollY; state.hist++; history.pushState({ i: state.hist }, '', target); }
    render();
  }
  function goBack(fallback) {
    if (state.hist > 0) history.back();
    else navigate(fallback || '/home', { replace: true });
  }
  function markActive() {
    const here = location.pathname;
    const full = location.pathname + location.search;
    document.querySelectorAll('a.x-link').forEach((a) => {
      const h = a.getAttribute('href') || '';
      const on = h.includes('?') ? h === full : h === here;
      if (on) { a.setAttribute('aria-current', 'page'); a.setAttribute('data-status', 'active'); a.classList.add('active'); }
      else if (a.hasAttribute('data-status')) { a.removeAttribute('aria-current'); a.removeAttribute('data-status'); a.classList.remove('active'); }
    });
  }

  /* ------------------------------------------------------------------ infinite scroll */
  function homeTimelineUl() {
    if (!shell || state.page !== null && state.page.kind !== 'home') return null;
    if (state.homeTab !== 'for-you' && isLoggedIn()) return null;
    return shell.main.querySelector('[id="urt:home:for-you"] > ul');
  }
  function maybeLoadMore() {
    if (loadingMore || modal || state.homeCount >= 50) return;
    const ul = homeTimelineUl();
    if (!ul) return;
    if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 1500) return;
    loadingMore = true;
    setTimeout(() => {
      loadingMore = false;
      if (homeTimelineUl() !== ul) return;
      let html = '';
      const end = Math.min(50, state.homeCount + 10);
      for (let i = state.homeCount; i < end; i++) html += cellHTML(homePost(i));
      state.homeCount = end;
      ul.insertAdjacentHTML('beforeend', html);
      if (state.homeCount >= 50) { const sp = ul.parentElement.querySelector('[role="progressbar"]'); if (sp) sp.remove(); }
      markActive();
      maybeLoadMore();
    }, 120);
  }

  /* ------------------------------------------------------------------ menus */
  function closeMenu() {
    if (!openMenu) return;
    openMenu.portal.remove();
    if (openMenu.trigger.isConnected) openMenu.trigger.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }
  function showMenu(trigger, items, o) {
    o = o || {};
    const same = openMenu && openMenu.trigger === trigger;
    closeMenu();
    if (same) return;
    const portal = document.createElement('div');
    portal.innerHTML = `<div role="menu" tabindex="-1" aria-orientation="vertical" class="x-menu" style="position:fixed;top:0;left:0">${items.map((it, i) => `<div role="menuitem" tabindex="-1" data-index="${i}" class="x-menuitem${it.danger ? ' text-red-500' : ''}">${it.icon || ''}<span>${esc(it.label)}</span></div>`).join('')}</div>`;
    document.body.appendChild(portal);
    const menu = portal.firstElementChild;
    const r = trigger.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    let left = o.align === 'start' ? r.left : r.right - w;
    left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = o.above ? r.top - h - 8 : r.bottom + 4;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(Math.max(8, top))}px`;
    trigger.setAttribute('aria-expanded', 'true');
    openMenu = { portal, trigger, items };
    menu.focus({ preventScroll: true });
  }
  const mi = (icon) => (icon.startsWith('icon-') ? useIcon(icon) : sicon(icon, 'size-5'));
  function copyText(t) { try { const p = navigator.clipboard && navigator.clipboard.writeText(t); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } }

  /* ------------------------------------------------------------------ modals */
  function closeModal() {
    if (!modal) return;
    modal.portal.remove();
    modal = null;
    document.documentElement.style.overflow = '';
  }
  function closeModalRoute() {
    if (!modal) return;
    goBack(modal.bg);
  }
  function openRouteModal(md, q, bg) {
    const key = location.pathname + location.search;
    if (modal && modal.key === key) return;
    closeModal();
    let html;
    const closeBtn = (cls) => `<button type="button" aria-label="Close" class="${cls}">${sicon('close', 'size-5')}</button>`;
    if (md.modal === 'compose') {
      const replyTo = q.get('in_reply_to');
      const quote = q.get('quote');
      const target = replyTo ? POSTS.get(replyTo) : null;
      let ctx = '';
      if (target) {
        const u = getUser(target.author);
        ctx = `<div class="flex gap-3 px-4 pt-1"><div class="flex w-10 shrink-0 flex-col items-center">${avatar(u, 'size-10')}<div class="w-0.5 grow bg-(--x-border-normal) mt-1 min-h-4"></div></div><div class="min-w-0 flex-1 pb-3"><div class="flex min-w-0 items-center gap-1 text-body"><span class="truncate font-bold text-primary">${esc(u.name)}</span>${badge(u)}<span class="truncate text-secondary">@${esc(u.handle)} · ${relTime(target.time)}</span></div><div class="text-body text-primary whitespace-pre-wrap wrap-anywhere" dir="auto">${esc(target.text)}</div><div class="mt-3 text-body text-secondary">Replying to <a class="x-link text-brand" href="/${esc(u.handle)}">@${esc(u.handle)}</a></div></div></div>`;
      }
      const quoted = quote && POSTS.get(quote);
      html = `<div class="fixed inset-0 z-40" style="background-color:rgba(91,112,131,.4)" aria-hidden="true" data-backdrop=""></div><div class="x-modal-positioner fixed inset-0 z-50 flex items-start justify-center overflow-y-auto sm:py-[5vh]"><div role="dialog" aria-modal="true" aria-label="${target ? 'Reply' : 'Compose post'}" class="relative flex w-full min-h-full flex-col bg-modal sm:w-[600px] sm:min-h-0 sm:rounded-2xl"><div class="flex h-[53px] items-center justify-between px-2">${closeBtn('x-iconbtn text-primary')}<span class="px-3 text-body font-bold text-brand">Drafts</span></div>${ctx}${composerHTML('modal', { replyTo: target ? target.id : null, quote: quoted ? quoted.id : null, text: q.get('text') || '', button: target ? 'Reply' : 'Post', placeholder: target ? 'Post your reply' : 'What’s happening?', extra: quoted ? `<div class="pb-3">${quoteHTML(quoted)}</div>` : '' })}</div></div>`;
    } else {
      let src;
      let w = 1200;
      let h = 675;
      let nav = '';
      if (md.modal === 'avatar') {
        const u = getUser(md.handle);
        if (md.which === 'photo') { src = avatarUrl(u, '400x400'); w = h = 400; } else { src = u.banner; w = 1500; h = 500; }
      } else {
        const p = getPostFor(md.id, md.handle);
        const list = p.media.length ? p.media : [{ mid: p.video ? p.video.mid : mediaId(p.id), w: 1280, h: 720 }];
        const n = Math.min(Math.max(1, md.n), list.length);
        const m = list[n - 1];
        src = mediaUrl(m, 'large'); w = m.w; h = m.h;
        const base = `/${md.handle}/status/${md.id}/photo/`;
        if (n > 1) nav += `<button type="button" aria-label="Previous slide" data-photo-nav="${base}${n - 1}" class="x-viewer-btn start-3" style="top:calc(50% - 18px)">${sicon('arrow-left', 'size-5')}</button>`;
        if (n < list.length) nav += `<button type="button" aria-label="Next slide" data-photo-nav="${base}${n + 1}" class="x-viewer-btn end-3" style="top:calc(50% - 18px);transform:scaleX(-1)">${sicon('arrow-left', 'size-5')}</button>`;
        if (list.length > 1) nav += `<div class="absolute bottom-3 rounded-full bg-black-80 px-3 py-1 text-subtext2 text-white" style="left:50%;transform:translateX(-50%)">${n} / ${list.length}</div>`;
      }
      html = `<div role="dialog" aria-modal="true" aria-label="Image" class="x-photo-viewer fixed inset-0 z-50 flex items-center justify-center"><img alt="Image" draggable="false" width="${w}" height="${h}" src="${esc(src)}">${closeBtn('x-viewer-btn start-3 top-3')}${nav}</div>`;
    }
    const portal = document.createElement('div');
    portal.innerHTML = html;
    document.body.appendChild(portal);
    modal = { portal, key, bg };
    document.documentElement.style.overflow = 'hidden';
    const box = portal.querySelector('[role="textbox"]');
    if (box) {
      box.focus();
      if (box.textContent) { const sel = getSelection(); sel.selectAllChildren(box); sel.collapseToEnd(); }
    }
  }

  /* ------------------------------------------------------------------ actions */
  const postIdFromGroup = (g) => { const a = g && g.querySelector('[data-engagement-action="reply"] a'); return a ? new URL(a.href).searchParams.get('in_reply_to') : null; };
  function updateGroups(p) {
    document.querySelectorAll('[role="group"][aria-label$="views"]').forEach((g) => {
      if (postIdFromGroup(g) !== p.id) return;
      const c = p.counts;
      g.setAttribute('aria-label', groupLabel(c));
      const set = (sel, label, pressed, icon, onCls, n) => {
        const el = g.querySelector(sel);
        if (!el) return;
        if (label) el.setAttribute('aria-label', label);
        if (pressed !== null) el.setAttribute('aria-pressed', String(pressed));
        if (onCls) { el.classList.toggle(onCls, !!pressed); el.classList.toggle('text-secondary', !pressed); }
        if (icon) el.querySelector('use').setAttribute('href', '#' + icon);
        const cnt = el.querySelector('.x-animated-count-visual');
        if (cnt && n !== undefined) cnt.textContent = n ? fmt(n) : '';
      };
      set('[data-engagement-action="reply"] a', `${c.reply} Replies. Reply`, null, null, null, c.reply);
      set('[data-engagement-action="retweet"] button', `${c.repost} reposts. ${p.reposted ? 'Reposted' : 'Repost'}`, p.reposted, null, 'text-green-500', c.repost);
      set('[data-engagement-action="like"] button', `${c.like} Likes. ${p.liked ? 'Liked' : 'Like'}`, p.liked, p.liked ? 'icon-heart-filled' : 'icon-heart', 'text-magenta-500', c.like);
      set('[data-engagement-action="bookmark"] button', null, p.bookmarked, p.bookmarked ? 'icon-bookmark-filled' : 'icon-bookmark', 'text-brand');
    });
  }
  function toggleFollow(handle) {
    const u = getUser(handle);
    const k = u.handle.toLowerCase();
    const on = !state.following.has(k);
    if (on) state.following.add(k); else state.following.delete(k);
    api(on ? 'follow' : 'unfollow', { handle: u.handle });
    document.querySelectorAll('button.x-follow').forEach((b) => {
      const m = /@(\w+)$/.exec(b.getAttribute('aria-label') || '');
      if (!m || m[1].toLowerCase() !== k) return;
      b.setAttribute('aria-label', `${on ? 'Following' : 'Follow'} @${u.handle}`);
      b.textContent = on ? 'Following' : 'Follow';
    });
  }
  function onEngagement(btn, action) {
    const g = btn.closest('[role="group"]');
    const p = POSTS.get(postIdFromGroup(g));
    if (!p) return;
    if (action === 'like') {
      p.liked = !p.liked; p.counts.like += p.liked ? 1 : -1;
      api(p.liked ? 'like' : 'unlike', p.id); updateGroups(p);
    } else if (action === 'bookmark') {
      p.bookmarked = !p.bookmarked; p.counts.bookmark += p.bookmarked ? 1 : -1;
      api(p.bookmarked ? 'bookmark' : 'unbookmark', p.id); updateGroups(p);
    } else if (action === 'retweet') {
      showMenu(btn, [
        { label: p.reposted ? 'Undo repost' : 'Repost', icon: mi('icon-repost'), run: () => { p.reposted = !p.reposted; p.counts.repost += p.reposted ? 1 : -1; api(p.reposted ? 'repost' : 'unrepost', p.id); updateGroups(p); } },
        { label: 'Quote', icon: mi('quote'), run: () => navigate(`/compose/post?quote=${p.id}`) },
      ], { align: 'start' });
    } else if (action === 'share') {
      const u = getUser(p.author);
      showMenu(btn, [
        { label: 'Copy link', icon: mi('link'), run: () => copyText(`${location.origin}/${u.handle}/status/${p.id}`) },
        { label: 'Share post via …', icon: mi('icon-share-ios'), run: () => {} },
        { label: 'Send via Direct Message', icon: mi('messages'), run: () => navigate('/i/chat') },
      ]);
    }
  }
  function postMenu(btn) {
    const art = btn.closest('article');
    const p = POSTS.get(postIdFromGroup(art && art.querySelector('[role="group"]')));
    if (!p) return;
    const u = getUser(p.author);
    const following = state.following.has(u.handle.toLowerCase());
    const items = [
      { label: 'Not interested in this post', icon: mi('frown'), run: () => {
        api('not_interested', p.id);
        const cell = art.closest('li') || art.parentElement;
        const note = document.createElement('div');
        note.className = 'border-b border-divider px-4 py-4 text-body text-secondary';
        note.textContent = 'Thanks. You’ll see fewer posts like this.';
        cell.replaceChildren(note);
      } },
      { label: `${following ? 'Unfollow' : 'Follow'} @${u.handle}`, icon: mi('person'), run: () => toggleFollow(u.handle) },
      { label: 'Copy link', icon: mi('link'), run: () => copyText(`${location.origin}/${u.handle}/status/${p.id}`) },
    ];
    if (u.handle === ME) items.splice(0, 2);
    showMenu(btn, items);
  }
  function newPost(text, extra) {
    state.seq++;
    return addPost(Object.assign({ id: '21238990000' + String(10000000 + state.seq), author: ME, time: NOW, text, counts: { reply: 0, repost: 0, like: 0, bookmark: 0, view: 0 } }, extra));
  }
  function updateComposer(c) {
    const box = c.querySelector('[role="textbox"]');
    const btn = c.querySelector('.x-composer-submit');
    if (!box || !btn) return;
    if (box.textContent === '' && box.innerHTML !== '') box.innerHTML = '';
    btn.disabled = !box.textContent.trim();
  }
  function submitComposer(c) {
    const box = c.querySelector('[role="textbox"]');
    const text = (box.innerText || box.textContent || '').trim();
    if (!text) return;
    const kind = c.getAttribute('data-composer');
    box.innerHTML = '';
    updateComposer(c);
    if (kind === 'chat') {
      const conv = CONVOS.find((x) => x.id === c.getAttribute('data-conversation'));
      if (conv) conv.msgs.push([1, text]);
      api('dm', { conversation: c.getAttribute('data-conversation'), text });
      const list = shell.main.querySelector('.x-messages');
      if (list) { list.insertAdjacentHTML('beforeend', bubble(true, text)); list.scrollTop = list.scrollHeight; }
      box.focus();
      return;
    }
    const replyTo = c.getAttribute('data-reply-to');
    const quote = c.getAttribute('data-quote');
    if (replyTo) {
      const p = newPost(text, { replyTo });
      api('reply', { id: replyTo, text });
      (state.extraReplies[replyTo] = state.extraReplies[replyTo] || []).push(p);
      const parent = POSTS.get(replyTo);
      if (parent) { parent.counts.reply++; updateGroups(parent); }
      const conv = shell.main.querySelector(`[id="urt:conversation:${replyTo}"] > ul`);
      if (conv && conv.children[2]) { conv.children[2].insertAdjacentHTML('afterend', cellHTML(p)); }
    } else {
      const p = newPost(text, quote ? { quote } : {});
      api('post', quote ? { text, quote } : { text });
      state.myPosts.unshift(p);
      const ul = homeTimelineUl();
      if (ul) ul.insertAdjacentHTML('afterbegin', cellHTML(p));
    }
    markActive();
    if (kind === 'modal') closeModalRoute();
  }

  /* ------------------------------------------------------------------ events */
  const INTERACTIVE = 'a,button,input,textarea,select,label,video,[role="button"],[role="menuitem"],[role="tab"],[contenteditable="true"]';
  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (openMenu) {
      const item = t.closest('[role="menuitem"]');
      if (item && openMenu.portal.contains(item)) {
        e.preventDefault();
        const it = openMenu.items[+item.getAttribute('data-index')];
        closeMenu();
        if (it && it.run) it.run();
        return;
      }
    }
    const btn = t.closest('button');
    if (btn && !btn.disabled) {
      const ea = btn.closest('[data-engagement-action]');
      if (ea && ea.closest('[role="group"]')) { e.preventDefault(); onEngagement(btn, ea.getAttribute('data-engagement-action')); return; }
      const label = btn.getAttribute('aria-label') || '';
      if (btn.classList.contains('x-follow')) { e.preventDefault(); toggleFollow(label.replace(/^.*@/, '')); return; }
      if (label === 'More' && btn.closest('article')) { e.preventDefault(); postMenu(btn); return; }
      if (btn.classList.contains('x-composer-submit')) { e.preventDefault(); submitComposer(btn.closest('.x-composer')); return; }
      if (label === 'Close' && modal && modal.portal.contains(btn)) { e.preventDefault(); closeModalRoute(); return; }
      if (label === 'Back') { e.preventDefault(); goBack('/home'); return; }
      if (btn.hasAttribute('data-photo-nav')) { e.preventDefault(); navigate(btn.getAttribute('data-photo-nav'), { replace: true }); return; }
      if (btn.hasAttribute('data-premium-cta')) { e.preventDefault(); navigate('/i/premium_sign_up'); return; }
      if (label === 'More menu items') {
        e.preventDefault();
        showMenu(btn, [{ label: 'Lists', icon: mi('poll'), run: () => navigate(`/${ME}/lists`) }, { label: 'Monetization', icon: mi('premium'), run: () => navigate('/i/monetization') }, { label: 'Settings and privacy', icon: mi('settings'), run: () => navigate('/settings') }], { align: 'start' });
        return;
      }
      if (label === 'Account menu') {
        e.preventDefault();
        showMenu(btn, [{ label: 'Add an existing account', run: () => {} }, { label: `Log out @${ME}`, run: () => navigate('/logout') }], { align: 'start', above: true });
        return;
      }
      if (label === 'Play' || label === 'Pause') {
        e.preventDefault();
        const playing = label === 'Play';
        btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        const ov = btn.parentElement.querySelector('.x-video-overlay');
        if (ov) ov.style.opacity = playing ? '0' : '1';
        return;
      }
      if (btn.getAttribute('role') === 'tab' && state.page && state.page.kind === 'home') {
        e.preventDefault();
        const tab = btn.textContent.trim() === 'Following' ? 'following' : 'for-you';
        if (tab !== state.homeTab) { state.homeTab = tab; window.__mockXRenders++; renderPage(state.renderedKey); markActive(); window.scrollTo(0, 0); setTimeout(maybeLoadMore, 0); }
        return;
      }
      return;
    }
    const a = t.closest('a[href]');
    if (a) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      e.preventDefault();
      if (u.pathname + u.search === location.pathname + location.search && !u.hash) { window.scrollTo(0, 0); return; }
      navigate(u.pathname + u.search + u.hash);
      return;
    }
    if (modal) {
      if (t.classList.contains('x-modal-positioner') || t.classList.contains('x-photo-viewer')) { e.preventDefault(); closeModalRoute(); return; }
    }
    const cell = t.closest('[role="link"][data-href]');
    if (cell) {
      const inter = t.closest(INTERACTIVE);
      if (inter && cell.contains(inter) && inter !== cell) return;
      if (String(getSelection() || '')) return;
      e.preventDefault();
      navigate(cell.getAttribute('data-href'));
    }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !openMenu.portal.contains(e.target) && !openMenu.trigger.contains(e.target)) closeMenu();
  }, true);
  document.addEventListener('input', (e) => {
    const c = e.target instanceof Element && e.target.closest('.x-composer');
    if (c) updateComposer(c);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!(f instanceof HTMLFormElement) || f.getAttribute('role') !== 'search') return;
    e.preventDefault();
    const q = (f.querySelector('input') || {}).value || '';
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}&src=typed_query`);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (openMenu) { const tr = openMenu.trigger; closeMenu(); if (tr.isConnected) tr.focus(); e.preventDefault(); return; }
      if (modal) { e.preventDefault(); closeModalRoute(); }
      return;
    }
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (e.key === 'Enter') {
      const c = t.closest('.x-composer');
      if (c && t.getAttribute('role') === 'textbox' && (e.metaKey || e.ctrlKey || (c.getAttribute('data-composer') === 'chat' && !e.shiftKey))) { e.preventDefault(); submitComposer(c); return; }
      if (t.getAttribute('role') === 'menuitem' || (t.getAttribute('role') === 'link' && t.hasAttribute('data-href'))) { e.preventDefault(); t.click(); }
    }
  });
  window.addEventListener('popstate', (e) => {
    state.hist = (e.state && typeof e.state.i === 'number') ? e.state.i : 0;
    render({ restore: true });
  });
  window.addEventListener('scroll', () => { if (!modal) state.scroll[state.hist] = window.scrollY; maybeLoadMore(); }, { passive: true });
  window.addEventListener('resize', positionAside);

  function boot() {
    if (history.state && typeof history.state.i === 'number') state.hist = history.state.i;
    else history.replaceState({ i: 0 }, '', location.href);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

/** The single-page-app HTML served for every x.com / twitter.com page URL. */
export function mockXHtml(theme = 'dark') {
  return `<!DOCTYPE html><html lang="en" dir="ltr" data-theme="${theme === 'light' ? 'light' : 'dark'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="light dark"><title>X</title><link rel="icon" href="data:,"><style>${TOKENS_CSS}${APP_CSS}</style><script>(${mockXClient.toString()})();</script></head><body>${SPRITE}</body></html>`;
}

/**
 * Installs the fake X on a Playwright BrowserContext.
 * `log` collects write actions: { type: 'like'|'unlike'|'bookmark'|'unbookmark'|'repost'|'unrepost'|'not_interested', id },
 * { type: 'follow'|'unfollow', handle }, { type: 'post', text, quote? }, { type: 'reply', id, text }, { type: 'dm', conversation, text }.
 */
export async function installMockX(context, log = []) {
  await context.route(/^https:\/\/pbs\.twimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*', 'cache-control': 'max-age=3600' }, body: svgImage(route.request().url()) }));
  await context.route(/^https:\/\/(abs|abs-0|video|ton)\.twimg\.com\//, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: '' }));
  await context.route(/^https:\/\/(www\.|mobile\.)?(x|twitter)\.com\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    if (p.startsWith('/i/api/mock/')) {
      if (req.method() === 'POST') {
        const type = p.slice('/i/api/mock/'.length).replace(/\/+$/, '');
        const body = req.postData() ?? '';
        let entry = { type, id: body };
        if (body.trim().startsWith('{')) {
          try { entry = { type, ...JSON.parse(body) }; } catch { /* keep raw */ }
        }
        log.push(entry);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    if (p.startsWith('/i/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (p === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
    if (/\.[a-z0-9]{1,10}$/i.test(p)) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: mockXHtml(u.searchParams.get('theme') === 'light' ? 'light' : 'dark'),
    });
  });
}
