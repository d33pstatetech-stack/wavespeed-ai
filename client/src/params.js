// Pure helpers ported from the vanilla app (params logic, unchanged behavior).

export function getParamType(name, spec = {}) {
  if (name === 'image_url' || (name.includes('image') && spec.format === 'uri')) return 'image';
  if (name === 'images_list' || (name.includes('image') && spec.type === 'array')) return 'image_array';
  if (name === 'last_image') return 'image';
  if (spec.options && spec.options.length > 0) return 'select';
  if (spec.type === 'number' && spec.min !== undefined && spec.max !== undefined) return 'range';
  if (spec.type === 'number') return 'number';
  if (spec.type === 'boolean') return 'boolean';
  return 'string';
}

export function isLoraParam(name, spec = {}) {
  const n = String(name || '').toLowerCase();
  if (n === 'extra_lora' || n === 'extra_lora_weights' || /(^|_)replicate_weights$/.test(n)) return true;
  if (/scale|strength|weight|multiplier/.test(n)) return false;
  if (/lora|loras|adapter/.test(n)) return true;
  return false;
}

export function loraHintText() {
  return 'Best first: full https://….safetensors URL (required on WaveSpeed — civitai: shorthand is NOT supported) · HuggingFace owner/repo (some endpoints). Multi-LoRA fields: one per line (commas also work).';
}

export function sizeHintText() {
  return 'Format: width*height (e.g. 1024*1024). Limits vary by model — width/height fields show their own min/max where the schema defines them.';
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
