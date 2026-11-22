/**
 * reddit.com enforces Trusted Types, which makes raw string → HTML sinks (innerHTML, DOMParser)
 * throw. We route our already-sanitized HTML through a named policy when one is available.
 */
type Policy = { createHTML: (s: string) => unknown };
let policy: Policy | null | undefined;

function getPolicy(): Policy | null {
  if (policy !== undefined) return policy;
  policy = null;
  const tt = (window as unknown as { trustedTypes?: { createPolicy: (n: string, r: Policy) => Policy } }).trustedTypes;
  if (tt) {
    for (const name of ['orbit', 'orbit#1', 'default']) {
      try { policy = tt.createPolicy(name, { createHTML: (s: string) => s }); break; } catch { /* name taken or not allowed */ }
    }
  }
  return policy;
}

export function trustedHTML(s: string): string {
  const p = getPolicy();
  return (p ? p.createHTML(s) : s) as string;
}

/** Parses HTML into an inert document without touching any Trusted Types sink when possible. */
export function parseHTML(html: string): Document {
  return new DOMParser().parseFromString(trustedHTML(html), 'text/html');
}
