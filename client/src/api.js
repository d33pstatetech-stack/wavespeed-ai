// Thin wrappers over the existing WaveSpeed worker API (unchanged backend).
const API = '';

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

export function errText(v, fallback = '') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => errText(x, '')).filter(Boolean).join('; ') || fallback;
  if (typeof v === 'object') return errText(v.message ?? v.error ?? v.detail ?? v.msg, fallback);
  return String(v);
}

export async function fetchModels() {
  const res = await fetch(`${API}/api/models?limit=1000`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.message || data.error, `Models failed (${res.status})`));
  return Array.isArray(data) ? data : data.models || [];
}

export async function fetchHealth() {
  const res = await fetch(`${API}/api/health`);
  return json(res);
}

export async function syncCatalog() {
  const res = await fetch(`${API}/api/sync`, { method: 'POST' });
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.message || data.error, `Sync failed (${res.status})`));
  return data;
}

export async function fetchModel(id) {
  const res = await fetch(`${API}/api/models/${encodeURIComponent(id)}`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.message || data.error, `Model failed (${res.status})`));
  return data;
}

export async function submitGenerate({ modelId, params, enhancementId }) {
  const res = await fetch(`${API}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, params, enhancementId: enhancementId || null }),
  });
  const data = await json(res);
  if (!res.ok) {
    throw new Error(errText(data.message, '') || errText(data.error, '') || errText(data.details?.detail, '') || `Generation failed (${res.status})`);
  }
  return data; // { requestId, cost }
}

export async function pollPrediction(requestId) {
  const res = await fetch(`${API}/api/predictions/${requestId}`);
  const data = await json(res);
  // NOTE: WaveSpeed normalizes poll responses to {status, outputs, error}
  // ('completed' | 'failed' | running raw status). Never throw here —
  // callers normalize `status`/`error` and must surface failures, not spin.
  if (data && typeof data === 'object') data._http = res.status;
  return data; // { status, outputs?, error?, detail? }
}

export async function estimateCost({ modelId, params }) {
  const res = await fetch(`${API}/api/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, params }),
  });
  return json(res);
}

export async function uploadFileBlob(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.message || data.error, `Upload failed (${res.status})`));
  return data;
}

export async function saveOutputs({ urls, model, jobId }) {
  const res = await fetch(`${API}/api/wavespeed/save-outputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, model, jobId }),
  });
  return json(res);
}

export async function linkEnhancement({ externalJobId, enhancementId }) {
  try {
    await fetch(`${API}/api/history/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'wavespeed', external_job_id: externalJobId, enhancement_id: enhancementId }),
    });
  } catch {
    /* fire-and-forget */
  }
}

export async function rateJob({ externalJobId, rating }) {
  const res = await fetch(`${API}/api/history/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'wavespeed', external_job_id: externalJobId, rating }),
  });
  return json(res);
}

export async function fetchModelStats({ limit = 50 } = {}) {
  const res = await fetch(`${API}/api/history/model-stats?limit=${encodeURIComponent(limit)}`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.message || data.error, `Model stats failed (${res.status})`));
  if (Array.isArray(data)) return data;
  return data.models || data.stats || [];
}

export async function cloudList({ prefix = '', flat = false, cursor = null } = {}) {
  // Worker uses `recursive=1` for flat listing (same contract as the MuAPI worker).
  const q = new URLSearchParams({ prefix, ...(flat ? { recursive: '1' } : {}), ...(cursor ? { cursor } : {}) });
  const res = await fetch(`${API}/api/cloud/list?${q}`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error || data.message, `R2 list failed (${res.status})`));
  return data; // { objects, folders, truncated, cursor }
}

export function cloudFileUrl(key) {
  return `${API}/api/cloud/file?key=${encodeURIComponent(key)}`;
}

export async function cloudResolve(key) {
  const res = await fetch(`${API}/api/cloud/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error || data.message, `Resolve failed (${res.status})`));
  return data; // { url, via }
}

export async function fetchLlmConfig(signal) {
  const res = await fetch(`${API}/api/llm-config`, { signal });
  return json(res);
}

export async function saveLlmConfig(config) {
  await fetch(`${API}/api/llm-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: config }),
  }).catch(() => {});
}

// Streaming enhance — real protocol: POST {rawPrompt, modelId, params, modality} →
// SSE OpenAI-style chunks (choices[0].delta.content) + {history_id} event,
// X-Provider-Used / X-Model-Used headers, JSON fallback {enhanced,…}.
// `modality` ('image' | 'video' | null) is the client's own read of the selected
// model; the Worker prefers it over its own derivation so a mis-classified
// model row cannot hand an image target the video template.
export async function streamEnhance({ rawPrompt, modelId, params, modality, signal, onToken, onMeta }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  const onAbort = () => ctrl.abort();
  signal && signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`${API}/api/enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawPrompt, modelId, params, ...(modality ? { modality } : {}) }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      let msg = 'Enhance failed';
      try {
        const j = await res.json();
        msg = j.message || j.error || msg;
        if (j.providersTried?.length) msg += ` [tried: ${j.providersTried.join(' | ')}]`;
      } catch {
        try {
          msg = await res.text();
        } catch {
          /* keep default */
        }
      }
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    let full = '';
    let providerUsed = res.headers.get('X-Provider-Used') || '?';
    let modelUsed = res.headers.get('X-Model-Used') || '?';
    let historyId = null;
    if (ct.includes('text/event-stream') && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const d = line.slice(5).trim();
          if (d === '[DONE]' || !d) continue;
          try {
            const j = JSON.parse(d);
            if (j.history_id) {
              historyId = j.history_id;
              continue;
            }
            const delta = j.choices?.[0]?.delta?.content || '';
            if (delta) {
              full += delta;
              onToken && onToken(full);
            }
          } catch {
            /* partial chunk */
          }
        }
      }
    } else {
      const data = await res.json();
      full = data.enhanced || '';
      if (data.history_id) historyId = data.history_id;
      providerUsed = data.providerUsed || providerUsed;
      modelUsed = data.modelUsed || modelUsed;
    }
    if (!full) throw new Error('Empty LLM response');
    onMeta && onMeta({ providerUsed, modelUsed, historyId, length: full.length });
    return { text: full, providerUsed, modelUsed, historyId };
  } finally {
    clearTimeout(timer);
    signal && signal.removeEventListener('abort', onAbort);
  }
}

// Add-from-URL: resolve an HF/CivitAI model-card URL (or direct .safetensors
// file URL) to LoRA file(s). 60s client timeout so a dead CDN host fails
// visibly instead of hanging the button.
export async function resolveLoraUrl(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  opts.signal && opts.signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`${API}/api/lora/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    const data = await json(res);
    if (!res.ok) throw new Error(errText(data.error, `Resolve failed (${res.status})`));
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Resolve timed out after 60s — the host may be unreachable or the CDN link expired');
    throw e;
  } finally {
    clearTimeout(timer);
    opts.signal && opts.signal.removeEventListener('abort', onAbort);
  }
}

export async function fetchCustomLoras() {
  const res = await fetch(`${API}/api/loras/custom`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error, `Custom LoRAs failed (${res.status})`));
  return Array.isArray(data.loras) ? data.loras : [];
}

export async function saveCustomLora(entry) {
  const res = await fetch(`${API}/api/loras/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error, `Save failed (${res.status})`));
  return data;
}

export async function deleteCustomLora(id) {
  const res = await fetch(`${API}/api/loras/custom/${id}`, { method: 'DELETE' });
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error, `Delete failed (${res.status})`));
  return data;
}

// Central LoRA repository (read-only Phase A). Returns the raw rows; callers
// in lib/api.js wrap fail-soft. Pre-migration DBs get {loras:[]} (200).
export async function fetchLibrary() {
  const res = await fetch(`${API}/api/loras/library`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error, `Library failed (${res.status})`));
  return Array.isArray(data.loras) ? data.loras : [];
}

// Run-confirmed LoRA ↔ model pairs. Returns raw rows
// [{lora_id, model_id, app, job_id, ran_at}].
export async function fetchVerifications() {
  const res = await fetch(`${API}/api/loras/verifications`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error, `Verifications failed (${res.status})`));
  return Array.isArray(data.verifications) ? data.verifications : [];
}

// K5 — LoRA↔model pairs proven by 4-5★ rated runs in shared HISTORY.
// Returns the whole payload ({min_runs, min_solo, pairs, norm, scanned});
// setRunEvidence picks the rows the Worker already flagged green. Returns null
// (not []) when the endpoint is missing or unreachable, so the caller can tell
// "no evidence" from "empty evidence" — both of which leave behaviour as it was.
export async function fetchLoraEvidence() {
  const res = await fetch(`${API}/api/loras/evidence`);
  const data = await json(res);
  if (!res.ok) throw new Error(errText(data.error, `Evidence failed (${res.status})`));
  if (!data || typeof data !== 'object' || (!Array.isArray(data.pairs) && !Array.isArray(data.norm))) return null;
  return data;
}

// Jev structured-judgment pilot: verifier gate for enhancements (log-only).
export const APP_NAME = 'wavespeed';

export async function judgeEnhancement({ rawPrompt, enhanced, modelId }) {
  const res = await fetch(`${API}/api/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: { raw: rawPrompt, enhanced, model: modelId },
      questions: {
        preserves_intent: {
          type: 'noul',
          instructions: 'Does the enhanced prompt keep the same subject and scene as the original raw prompt, only adding detail?',
        },
      },
    }),
  });
  const data = await json(res);
  if (!res.ok || !data.ok) return { ok: false, error: errText(data.error, `Judge failed (${res.status})`) };
  return data;
}

// Fire-and-forget calibration logging; never throws.
export async function logVerdict({ app, model, question, probability, elapsed_ms }) {
  try {
    await fetch(`${API}/api/judge/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, model, question, probability, elapsed_ms }),
    });
  } catch {
    /* calibration is best-effort */
  }
  return null;
}
