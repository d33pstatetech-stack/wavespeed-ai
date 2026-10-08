import { useCallback, useState } from 'react';
import { fetchLlmConfig, saveLlmConfig } from '../api';
import { DEFAULT_LLM } from '../enhancer';

const KEY = 'wavespeed_llm_config';
// Adding a row seeds the primary provider, matching the vanilla settings modal
// in public/enhancer.js. `apiKeyEnv` is what authenticates the host on the
// Worker; with an empty apiKey the env secret is used and no key is stored.
const EMPTY_ROW = { provider: 'explabs', baseUrl: 'https://api.experientiallabs.ai/v1', model: 'glm-5.3-flash-abliterated', apiKey: '', apiKeyEnv: 'EXPLABS_API_KEY' };

// LLM fallback-chain config: localStorage wins, backend as fallback/mirror.
export default function useLlmConfig() {
  const [config, setConfig] = useState(null);

  const load = useCallback(async () => {
    try {
      const local = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (local?.providers?.length) {
        setConfig(local);
        return local;
      }
    } catch {
      /* fall through to backend */
    }
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 800);
      const data = await fetchLlmConfig(ctrl.signal).finally(() => clearTimeout(to));
      if (data?.config?.providers?.length) {
        setConfig(data.config);
        return data.config;
      }
    } catch {
      /* fall through to default */
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
