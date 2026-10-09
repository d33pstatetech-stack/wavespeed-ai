// Pure helpers for the enhancer fallback chain (no I/O, no React).
//
// A chain is `{ providers: [{ provider, baseUrl, model, apiKey, apiKeyEnv }] }`.
// Two stores hold it: D1 (server, admin-curated order) and localStorage
// (browser, may hold personal apiKeys). Either side can predate the other, so
// load() merges instead of letting one silently shadow the other.

/** Identity of one chain entry: normalized host + exact model string. */
export function llmProviderKey(p) {
  const host = String(p?.baseUrl ?? '').trim().toLowerCase();
  const model = String(p?.model ?? '').trim();
  return `${host}\n${model}`;
}

/**
 * Merge the server chain into a locally saved one.
 *
 * - Order follows the backend (it is the curated failover priority: the first
 *   provider that answers wins).
 * - Matching entries keep the LOCAL object, so personal apiKeys and edits win
 *   over the redacted/empty values the backend returns.
 * - Backend providers missing locally are inserted at their backend position —
 *   this is what heals a browser chain saved before a provider was added.
 * - Local-only entries (user customs) are appended at the end, in local order.
 *
 * Returns `{ chain, changed }`. `changed` is false when the merge is a no-op,
 * so callers can skip the localStorage write. When the backend has no
 * providers the local chain is returned untouched.
 */
export function mergeLlmChains(local, backend) {
  const bp = backend && Array.isArray(backend.providers) ? backend.providers : [];
  if (!bp.length) return { chain: local ?? null, changed: false };
  const lp = local && Array.isArray(local.providers) ? local.providers : [];
  const localByKey = new Map();
  for (const p of lp) {
    const k = llmProviderKey(p);
    if (!localByKey.has(k)) localByKey.set(k, p);
  }
  const seen = new Set();
  const merged = bp.map((b) => {
    const k = llmProviderKey(b);
    seen.add(k);
    return localByKey.has(k) ? localByKey.get(k) : { ...b };
  });
  for (const p of lp) {
    const k = llmProviderKey(p);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(p);
    }
  }
  const chain = { ...(local && typeof local === 'object' ? local : {}), providers: merged };
  return { chain, changed: JSON.stringify(lp) !== JSON.stringify(merged) };
}
