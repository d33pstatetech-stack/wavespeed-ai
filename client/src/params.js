// Pure helpers ported from the vanilla app (params logic, unchanged behavior).

export function getParamType(name, spec = {}) {
  if (name === 'image_url' || (name.includes('image') && spec.format === 'uri')) return 'image';
  if (name === 'images_list' || (name.includes('image') && spec.type === 'array')) return 'image_array';
  if (name === 'last_image') return 'image';
  if (spec.options && spec.options.length > 0) return 'select';
  if (spec.type === 'number' && spec.min !== undefined && spec.max !== undefined) return 'range';
  if (isScaleParam(name, spec)) return 'range';
  if (spec.type === 'number') return 'number';
  if (spec.type === 'boolean') return 'boolean';
  return 'string';
}

/* LoRA strength fallback bounds. A numeric scale/strength param whose schema
   declares no bounds at all would otherwise render as a typeless number box.
   Schema bounds always win; the 0-2/step-0.05 fallback mirrors the
   {path, scale} convention and completed-run evidence (0.85-1.1 observed,
   default 1). */
export function isScaleParam(name, spec = {}) {
  const t = String(spec?.type || '').toLowerCase();
  if (t !== 'number' && t !== 'integer') return false;
  const n = String(name || '').toLowerCase();
  return /lora|adapter/.test(n) && /scale|strength/.test(n);
}

/* Bounds for a range control: schema min/max first, scale fallback when the
   schema is silent. Returns null when there is nothing to slide between. */
export function sliderBounds(name, spec = {}) {
  const lo = spec.min ?? spec.minimum;
  const hi = spec.max ?? spec.maximum;
  if (lo !== undefined && hi !== undefined && Number(hi) > Number(lo)) {
    return { min: Number(lo), max: Number(hi), step: rangeStep(spec) };
  }
  if (isScaleParam(name, spec)) return { min: 0, max: 2, step: 0.05 };
  return null;
}

/* Fine step for bounded numbers that declare none: integers stay whole,
   fractional ranges get ~100 detents on a 1/2/5 scale. A schema step always
   wins (lora_scale -1..3 was previously snapping to whole numbers). */
export function rangeStep(spec = {}) {
  if (spec.step !== undefined && spec.step !== null) return spec.step;
  const t = String(spec?.type || '').toLowerCase();
  if (t === 'integer') return 1;
  const lo = Number(spec.min ?? spec.minimum);
  const hi = Number(spec.max ?? spec.maximum);
  if (!(hi > lo) || !isFinite(hi - lo)) return 1;
  const raw = (hi - lo) / 100;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

/* An adapter INPUT carries weights; an adapter STRENGTH does not. The two are
   told apart by TYPE first, because the names collide:
     lora_weights  (string) -> a path/URL to load. This IS an adapter input.
     lora_weight   (number) -> "LoRA weight multiplier". This is NOT.
     lora_rank     (number) -> a trainer hyper-parameter. This is NOT.
   The previous name-only veto (/scale|strength|weight|multiplier/ before the
   lora test) rejected 2 real WaveSpeed adapter inputs that declare
   `lora_weights` in their live schema (pruna-ai/p-image/{edit,text-to-image}-lora)
   while accepting 11 trainer models whose only "lora" param is a numeric
   `lora_rank`. Type first, name second. lib/models.ts imports this function
   rather than keeping a second copy that can drift. */
export function isLoraParam(name, spec = {}) {
  const n = String(name || '').toLowerCase();
  const t = String(spec?.type || '').toLowerCase();
  // A number or a switch is a magnitude or a flag, never a weights path.
  if (t === 'number' || t === 'integer' || t === 'boolean') return false;
  if (n === 'extra_lora' || n === 'extra_lora_weights' || /(^|_)replicate_weights$/.test(n)) return true;
  if (/lora_weights|_lora_url$/.test(n)) return true;
  if (/scale|strength|weight|multiplier/.test(n)) return false;
  if (/lora|loras|adapter/.test(n)) return true;
  // An array of adapter objects: `lora_list` / `loras` items carry a `$ref` to
  // LoraItem. Scoped to lora-named refs so unrelated object arrays stop
  // reading as adapters.
  if (t === 'array') {
    const items = JSON.stringify(spec?.items ?? {});
    if (/\$ref/i.test(items) && /lora/i.test(items)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------
   Tier B — the UNVERIFIED adapter slot.

   A model whose published schema declares no adapter parameter cannot be
   shown a verified LoRA field, because submitting an adapter param to it is a
   guess the provider will reject. Some architectures may well support one
   (see TIER_B_FAMILIES in lib/models.ts).

   So Tier B gets an input that is OFF by default and only reaches the payload
   when the user explicitly opts in. `tierBLoraPayload` is the single place that
   decision is made, which is what makes it testable without a browser.

   EMPTY for WaveSpeed, on purpose — see TIER_B_FAMILIES in lib/models.ts.
   ------------------------------------------------------------------ */
export const TIER_B_LORA_PARAM = 'extra_lora';

/** `{}` unless the user ticked the opt-in AND typed something. */
export function tierBLoraPayload({ optIn, token } = {}) {
  const t = String(token ?? '').trim();
  return optIn && t ? { [TIER_B_LORA_PARAM]: t } : {};
}

export function loraHintText() {
  return 'Verified against live runs on wavespeed-ai/krea-v2/turbo-lora:\n  WORKS  https://REPO/resolve/main/FILE.safetensors\n  WORKS  owner/repo for a public HuggingFace repo\n  The field takes objects, not text: {path, scale}. Sent for you.\n  FAILS  a bare string - WaveSpeed answers "loras.0 must be an object"\n  FAILS  civitai:MODEL@VERSION - not supported\n  FAILS  {url: ...} - the key must be "path"\n  Multi-LoRA fields take one per line (commas also work)';
}

export function sizeHintText() {
  return 'Format is width*height (e.g. 1024*1024)\nLimits vary by model — width/height fields show their own min/max where the schema defines them';
}

export function loraTokenIssues(tok) {
  const t = String(tok || '').trim();
  if (!t) return null;
  if (/^civitai:\d+(@\d+)?$/i.test(t)) return 'civitai: shorthand is not supported on WaveSpeed — paste the full https://….safetensors URL';
  if (/^https?:\/\//i.test(t)) {
    if (/civitai\.com/i.test(t)) return null;
    if (!/\.safetensors(\?|#|$)/i.test(t)) return 'URL should point to a .safetensors file';
    return null;
  }
  if (/^huggingface\.co\//i.test(t) || /^civitai\.com\//i.test(t)) return 'WaveSpeed needs the full file URL — add the https:// scheme';
  if (/^[^/\s]+\/[^/\s]+$/.test(t)) return 'Short refs work on some endpoints only — the full URL is safer';
  return 'WaveSpeed needs a full https://….safetensors URL';
}

export function loraSlotCount(spec = {}) {
  const m = /max\s*(\d+)/i.exec(spec.description || '');
  const n = m ? parseInt(m[1], 10) : 3;
  return Math.min(Math.max(n || 3, 1), 5);
}

export function prettyLabel(name, spec = {}) {
  return spec.title || String(name).replace(/_/g, ' ');
}

// Sort: required first, then images → selects → numbers → booleans → strings.
export function sortParamEntries(entries) {
  const order = { image: 0, image_array: 0, select: 1, range: 2, number: 2, boolean: 3, string: 4 };
  return [...entries].sort(([aName, aSpec], [bName, bSpec]) => {
    if (aSpec.required && !bSpec.required) return -1;
    if (!aSpec.required && bSpec.required) return 1;
    const aOrd = order[getParamType(aName, aSpec)] ?? 5;
    const bOrd = order[getParamType(bName, bSpec)] ?? 5;
    return aOrd - bOrd || aName.localeCompare(bName);
  });
}

// Normalize LoRA-ish values for submit: strings/objects → [{path, scale}].
export function normalizeLoraValue(v) {
  const fix = (u) => {
    let s = String(u ?? '').trim();
    if (/^huggingface\.co\//i.test(s)) s = 'https://' + s;
    return s;
  };
  let arr;
  if (Array.isArray(v)) arr = v;
  else {
    const t = String(v ?? '').trim();
    if (!t) return undefined;
    let j = null;
    if (/^[[{]/.test(t)) {
      try {
        j = JSON.parse(t);
      } catch {
        /* fall through to split */
      }
    }
    arr = Array.isArray(j) ? j : j && typeof j === 'object' ? [j] : t.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
  const norm = arr
    .map((el) =>
      el && typeof el === 'object'
        ? { path: fix(el.path || el.url || ''), scale: typeof el.scale === 'number' ? el.scale : 1 }
        : { path: fix(el), scale: 1 }
    )
    .filter((o) => o.path);
  return norm.length ? norm : undefined;
}

// Strip empties + normalize LoRA lists, mirroring vanilla generate().
export function buildSubmitParams(prompt, values) {
  const params = { prompt, ...values };
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete params[k];
  }
  for (const k of ['lora_list', 'loras']) {
    if (params[k] === undefined) continue;
    const norm = normalizeLoraValue(params[k]);
    if (norm) params[k] = norm;
    else delete params[k];
  }
  return params;
}
