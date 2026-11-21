/**
 * Reddit returns pre-rendered HTML for post bodies and comments. It is still treated as untrusted:
 * only an allow-list of tags and attributes survives, links are forced to be safe, nothing executes.
 */
const ALLOWED = new Set(['p', 'br', 'hr', 'a', 'strong', 'b', 'em', 'i', 'del', 's', 'sup', 'sub', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'img']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'link', 'meta', 'base', 'textarea', 'template', 'noscript']);

const cache = new Map<string, string>();

export function sanitize(html: string): string {
  if (!html) return '';
  const hit = cache.get(html);
  if (hit !== undefined) return hit;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Element) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      if (DROP.has(tag)) { el.remove(); continue; }
      if (!ALLOWED.has(tag)) { walk(el); el.replaceWith(...Array.from(el.childNodes)); continue; }
      for (const attr of Array.from(el.attributes)) {
        const n = attr.name.toLowerCase();
        const keep = (tag === 'a' && (n === 'href' || n === 'title')) || (tag === 'img' && (n === 'src' || n === 'alt'))
          || (n === 'class' && attr.value === 'md-spoiler-text') || ((tag === 'td' || tag === 'th') && n === 'align');
        if (!keep) el.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        if (/^(https?:|mailto:)/i.test(href) || /^\/(?!\/)/.test(href)) el.setAttribute('rel', 'noopener noreferrer nofollow');
        else el.removeAttribute('href');
      }
      if (tag === 'img') {
        if (!/^https:\/\//i.test(el.getAttribute('src') ?? '')) { el.remove(); continue; }
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      }
      walk(el);
    }
  };
  walk(doc.body);
  const out = doc.body.innerHTML.trim();
  if (cache.size > 2000) cache.clear();
  cache.set(html, out);
  return out;
}
