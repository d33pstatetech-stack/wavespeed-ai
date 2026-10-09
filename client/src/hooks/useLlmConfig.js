import { useCallback, useState } from 'react';
import { fetchLlmConfig, saveLlmConfig } from '../api';
import { DEFAULT_LLM } from '../enhancer';
import { mergeLlmChains } from '../lib/llmChain';

const KEY = 'wavespeed_llm_config';
// Adding a row seeds the primary provider, matching the vanilla settings modal
// in public/enhancer.js. `apiKeyEnv` is what authenticates the host on the
// Worker; with an empty apiKey the env secret is used and no key is stored.
const EMPTY_ROW = { provider: 'explabs', baseUrl: 'https://api.experientiallabs.ai/v1', model: 'glm-5.3-flash-abliterated', apiKey: '', apiKeyEnv: 'EXPLABS_API_KEY' };

// LLM fallback-chain config. The backend (D1) owns the order — it is the
// curated failover priority — while the browser copy owns personal values
// (apiKeys). load() merges the two so a chain saved before a provider was
// added server-side heals itself instead of shadowing the new entry forever.
// The merged chain is written back to localStorage only, never pushed to the
// backend implicitly: an explicit Save still owns the backend sync.
export default function useLlmConfig() {
  const [config, setConfig] = useState(null);

  const load = useCallback(async () => {
    let local = null;
    try {
      local = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      local = null;
    }
    const hasLocal = !!(local && Array.isArray(local.providers) && local.providers.length);
    let backend = null;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 800);
      const data = await fetchLlmConfig(ctrl.signal).finally(() => clearTimeout(to));
      if (data?.config?.providers?.length) backend = data.config;
    } catch {
      backend = null;
    }
    if (backend) {
      const { chain, changed } = mergeLlmChains(hasLocal ? local : null, backend);
      if (chain && changed) {
        try {
          localStorage.setItem(KEY, JSON.stringify(chain));
        } catch {
          /* private mode: serve merged without persisting */
        }
      }
      if (chain && Array.isArray(chain.providers) && chain.providers.length) {
        setConfig(chain);
        return chain;
      }
    }
    if (hasLocal) {
      setConfig(local);
      return local;
    }
    const d = structuredClone(DEFAULT_LLM);
    setConfig(d);
    return d;
  }, []);

  const save = useCallback(async (cfg) => {
    localStorage.setItem(KEY, JSON.stringify(cfg));
    setConfig(cfg);
    // Fire-and-forget backend sync with real keys restored where masked
    try {
      const real = JSON.parse(localStorage.getItem(KEY) || 'null');
      const next = structuredClone(cfg);
      next.providers.forEach((p, i) => {
        if (p.apiKey === '***' && real?.providers?.[i]) p.apiKey = real.providers[i].apiKey;
      });
      localStorage.setItem(KEY, JSON.stringify(next));
      setConfig(next);
    } catch {
      /* local-only */
    }
    await saveLlmConfig(cfg);
  }, []);

  return { config, load, save, EMPTY_ROW };
}
