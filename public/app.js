/**
 * WaveSpeed Prompt Generator - Frontend App
 * Features: image upload, dynamic params, templates, saved prompts, history
 */

const API = '/api';
let allModels = [];
let filteredModels = [];
let currentModel = null;
let currentSchema = null;
let currentParams = {};
let currentGroup = 'image';
let pollTimer = null;
let history = [];
let uploadTarget = null; // which param the upload modal is targeting
let uploadedImages = {}; // param_name → url or [urls]

// Expose for enhancer.js (which loads after this file, shares same global lexical scope via window)
try {
  Object.defineProperty(window, 'currentModel', { get: () => currentModel, set: (v) => { currentModel = v; }, configurable: true });
  Object.defineProperty(window, 'currentParams', { get: () => currentParams, set: (v) => { currentParams = v; }, configurable: true });
  Object.defineProperty(window, 'currentSchema', { get: () => currentSchema, set: (v) => { currentSchema = v; }, configurable: true });
  Object.defineProperty(window, 'allModels', { get: () => allModels, configurable: true });
  window.updatePayloadPreview = updatePayloadPreview; // defined later, will be overwritten — ensure global
} catch {}

// ── Templates ──
const TEMPLATES = [
  { name: 'Product Photo', icon: 'fa-box', prompt: 'Professional product photography of [subject], clean white background, studio lighting, soft shadows, commercial quality, 8k', model: 'flux-kontext-max-t2i', params: { aspect_ratio: '1:1' } },
  { name: 'Portrait', icon: 'fa-user', prompt: 'Cinematic portrait of [subject], shallow depth of field, golden hour lighting, bokeh background, shot on 85mm lens, photorealistic', model: 'midjourney-v7', params: { aspect_ratio: '3:4', stylize: 200 } },
  { name: 'Landscape', icon: 'fa-mountain', prompt: 'Breathtaking landscape of [scene], golden hour, dramatic clouds, panoramic view, ultra-detailed, 8k resolution, National Geographic style', model: 'flux-dev', params: { aspect_ratio: '16:9' } },
  { name: 'Cinematic Video', icon: 'fa-film', prompt: 'Cinematic shot of [scene], dramatic lighting, smooth camera movement, film grain, anamorphic lens, 24fps, color graded', model: 'kling-v2.1-master-t2v', params: { aspect_ratio: '16:9', duration: '5' } },
  { name: 'Anime Character', icon: 'fa-star', prompt: 'Anime character illustration of [description], vibrant colors, detailed shading, manga style, clean linework, studio quality', model: 'midjourney-niji', params: { aspect_ratio: '3:4', stylize: 500 } },
  { name: 'Logo Design', icon: 'fa-paint-brush', prompt: 'Modern minimalist logo design for [brand], clean vector style, professional, scalable, on white background', model: 'ideogram-v3-t2i', params: { aspect_ratio: '1:1', style: 'design' } },
  { name: 'Interior Design', icon: 'fa-couch', prompt: 'Interior design visualization of [room], modern style, natural lighting, architectural photography, 8k, photorealistic render', model: 'flux-kontext-pro-t2i', params: { aspect_ratio: '16:9' } },
  { name: 'Food Photography', icon: 'fa-utensils', prompt: 'Appetizing food photography of [dish], overhead shot, rustic wooden table, natural daylight, shallow depth of field, editorial quality', model: 'flux-dev', params: { aspect_ratio: '4:3' } },
];

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  setupEventListeners();
  loadHistory();
  setConnectionStatus(true);
});

// ── Load models ──
async function loadModels() {
  try {
    const res = await fetch(`${API}/models?limit=1000`);
    const data = await res.json();
    allModels = data.models || [];
    filterByGroup();
    setConnectionStatus(true);
    try {
      const h = await fetch(`${API}/health`).then((r) => r.json());
      const hc = document.getElementById('headerModelCount');
      const hs = document.getElementById('headerSyncedAt');
      if (hc) hc.textContent = h.models ?? allModels.length;
      if (hs && h.synced_at) {
        const d = new Date(h.synced_at);
        hs.textContent = `synced ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        hs.title = h.synced_at;
      } else if (hs && h.timestamp) {
        const d = new Date(h.timestamp);
        hs.textContent = `synced ${d.toLocaleDateString()}`;
        hs.title = h.timestamp;
      }
    } catch { /* ignore */ }
  } catch (e) {
    console.error('Failed to load models:', e);
    setConnectionStatus(false);
  }
}

async function syncCatalog() {
  const btn = document.getElementById('btnSync');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; }
  try {
    const res = await fetch(`${API}/sync`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Sync failed');
    await loadModels();
    if (currentModel) await selectModel(currentModel.id);
    const msg = data.added > 0
      ? `Updated: ${data.total} models (+${data.added} new)` + (data.with_params ? `, ${data.with_params} with params` : '')
      : `Already up to date: ${data.total} models`;
    showToast(msg, 'success');
  } catch (e) {
    showToast('Update failed: ' + e.message, 'error');
  } finally {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

function showToast(message, kind) {
  let el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast';
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 18px;border-radius:10px;font-size:13px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.background = kind === 'error' ? '#7f1d1d' : '#064e3b';
  el.style.color = '#fff';
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function filterByGroup() {
  if (currentGroup === 'all') {
    filteredModels = allModels;
  } else {
    filteredModels = allModels.filter(m => m.group_of === currentGroup);
  }
  renderModelDropdown();
  document.getElementById('modelCount').textContent = filteredModels.length;
}

// ── Render model dropdown ──
function renderModelDropdown() {
  const dropdown = document.getElementById('modelDropdown');
  const byCategory = {};
  for (const m of filteredModels) {
    const cat = m.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);

  let html = '';
  for (const [cat, models] of sorted) {
    models.sort((a, b) => a.name.localeCompare(b.name));
    html += `<div class="model-dropdown-header">${cat} (${models.length})</div>`;
    for (const m of models) {
      const cost = m.cost > 0 ? `$${m.cost}` : 'Free';
      const dyn = m.dynamic_pricing ? '*' : '';
      html += `<div class="model-dropdown-item" data-id="${m.id}">
        <span class="truncate">${m.id}</span>
        <span class="cost-tag">${cost}${dyn}</span>
      </div>`;
    }
  }
  dropdown.innerHTML = html || '<div class="p-4 text-sm text-gray-600">No models found</div>';

  dropdown.querySelectorAll('.model-dropdown-item').forEach(item => {
    item.addEventListener('click', () => selectModel(item.dataset.id));
  });
}

// ── Select model ──
async function selectModel(modelId) {
  currentModel = allModels.find(m => m.id === modelId);
  if (!currentModel) return;

  document.getElementById('modelSearch').value = modelId;
  document.getElementById('modelDropdown').classList.add('hidden');

  // Mark selected
  document.querySelectorAll('.model-dropdown-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === modelId);
  });

  // Show info
  const info = document.getElementById('modelInfo');
  info.classList.remove('hidden');
  document.getElementById('modelCategoryBadge').textContent = currentModel.category;
  const costStr = currentModel.cost > 0 ? `~$${currentModel.cost} per call` : 'Free';
  const dynStr = currentModel.dynamic_pricing ? ' (varies by params)' : '';
  document.getElementById('modelCostLabel').textContent = costStr + dynStr;
  document.getElementById('modelPlaygroundLink').href = `https://wavespeed.ai/models`;

  // Load params
  try {
    const res = await fetch(`${API}/models/${encodeURIComponent(modelId)}`);
    const data = await res.json();
    currentSchema = data.paramSchema;
    currentParams = {};
    uploadedImages = {};

    if (currentSchema && Object.keys(currentSchema.params).length > 0) {
      renderParams(currentSchema);
      document.getElementById('paramsPanel').classList.remove('hidden');
    } else {
      document.getElementById('paramsPanel').classList.add('hidden');
    }
  } catch (e) {
    document.getElementById('paramsPanel').classList.add('hidden');
  }

  // Model details panel
  renderModelDetails();
  updatePayloadPreview();
  document.getElementById('btnGenerate').disabled = false;
  updateCostEstimate();
}

// ── Render parameter form ──
function renderParams(schema) {
  const form = document.getElementById('paramsForm');
  form.innerHTML = '';
  currentParams = schema.defaults || {};

  const params = schema.params || {};
  const entries = Object.entries(params).filter(([n]) => n !== 'prompt');

  // Sort: required first, then by type (images first, then selects, then ranges, then text)
  entries.sort(([aName, aSpec], [bName, bSpec]) => {
    if (aSpec.required && !bSpec.required) return -1;
    if (!aSpec.required && bSpec.required) return 1;
    const typeOrder = { 'image': 0, 'select': 1, 'number': 2, 'boolean': 3, 'string': 4 };
    const aOrd = typeOrder[getParamType(aName, aSpec)] ?? 5;
    const bOrd = typeOrder[getParamType(bName, bSpec)] ?? 5;
    return aOrd - bOrd || aName.localeCompare(bName);
  });

  for (const [name, spec] of entries) {
    const group = document.createElement('div');
    group.className = 'param-group';

    const pType = getParamType(name, spec);
    const label = `<div class="param-label">
      ${spec.title || name.replace(/_/g, ' ')}
      ${spec.required ? '<span class="param-required">required</span>' : ''}
    </div>`;

    const desc = spec.description ? `<p class="param-desc">${spec.description}</p>` : '';

    let control = '';

    if (pType === 'image') {
      control = renderImageUpload(name, spec, false);
    } else if (pType === 'image_array') {
      control = renderImageUpload(name, spec, true);
    } else if (spec.options && spec.options.length > 0) {
      const opts = spec.options.map(o => {
        const sel = (schema.defaults?.[name] === o || spec.default === o) ? 'selected' : '';
        return `<option value="${o}" ${sel}>${o}</option>`;
      }).join('');
      control = `<select class="select-input" data-param="${name}">
        ${!spec.required ? '<option value="">--</option>' : ''}
        ${opts}
      </select>`;
    } else if (pType === 'range') {
      const def = schema.defaults?.[name] ?? spec.default ?? spec.min ?? 0;
      control = `<div class="param-range-row">
        <input type="range" data-param="${name}" min="${spec.min}" max="${spec.max}" value="${def}" step="1">
        <span class="range-val" id="rv_${name}">${def}</span>
      </div>`;
    } else if (pType === 'number') {
      const def = schema.defaults?.[name] ?? spec.default ?? '';
      control = `<input type="number" class="input" data-param="${name}" value="${def}"
        ${spec.min !== undefined ? `min="${spec.min}"` : ''} ${spec.max !== undefined ? `max="${spec.max}"` : ''}
        placeholder="${spec.title || name}">`;
    } else if (pType === 'boolean') {
      const def = schema.defaults?.[name] ?? spec.default ?? false;
      control = `<label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" data-param="${name}" ${def ? 'checked' : ''} class="accent-purple-500">
        <span class="text-xs text-gray-400">${def ? 'Enabled' : 'Disabled'}</span>
      </label>`;
    } else if (spec.type === 'array' && isLoraParam(name, spec)) {
      control = renderLoraSlots(name, spec, schema);
    } else {
      const def = schema.defaults?.[name] ?? spec.default ?? '';
      control = `<input type="text" class="input" data-param="${name}" value="${def}" placeholder="${spec.title || name}">`;
    }

    group.innerHTML = label + control + desc + paramHint(name, spec);
    form.appendChild(group);

    // Wire up events
    wireParamEvents(group, name, spec, pType);
  }
}

function getParamType(name, spec) {
  if (name === 'image_url' || (name.includes('image') && spec.format === 'uri')) return 'image';
  if (name === 'images_list' || (name.includes('image') && spec.type === 'array')) return 'image_array';
  if (name === 'last_image') return 'image';
  if (spec.options && spec.options.length > 0) return 'select';
  if (spec.type === 'number' && spec.min !== undefined && spec.max !== undefined) return 'range';
  if (spec.type === 'number') return 'number';
  if (spec.type === 'boolean') return 'boolean';
  return 'string';
}

// ── LoRA + size field hints & soft validation (warns, never blocks) ──
const LORA_PROVIDER = 'wavespeed';
function isLoraParam(name, spec) {
  const n = String(name || '').toLowerCase();
  if (n === 'extra_lora' || n === 'extra_lora_weights' || /(^|_)replicate_weights$/.test(n)) return true;
  if (/scale|strength|weight|multiplier/.test(n)) return false;
  if (/lora|loras|adapter/.test(n)) return true;
  return false;
}
function loraHintText() {
  return 'LoRA: HuggingFace <b>owner/repo</b> (file must sit at the repo root, else use the full URL), full <b>https://….safetensors</b> URL, or Civitai model link — max 3, one per line (commas also work). Strength is set separately, not here.';
}
function sizeHintText() {
  const mid = (typeof currentModel !== 'undefined' && currentModel && currentModel.id) || '';
  const capped = /qwen/i.test(mid) && /2512/.test(mid);
  return 'Format: <b>width*height</b> (e.g. 1024*1024).' + (capped ? ' Each side max <b>1536px</b>.' : ' Limits vary by model.');
}
function paramHint(name, spec) {
  const n = String(name || '').toLowerCase();
  const hasOpts = !!(spec && spec.options && spec.options.length);
  if ((n === 'size' || n === 'resolution') && !hasOpts && (!spec || spec.type === 'string' || spec.type === undefined)) {
    return `<p class="param-hint">${sizeHintText()}</p>`;
  }
  if (isLoraParam(name, spec)) {
    return `<p class="param-hint">${loraHintText()}</p><p class="lora-warn" data-lorawarn="${name}" style="display:none"></p>`;
  }
  return '';
}
function loraTokenIssues(tok) {
  const t = String(tok || '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    if (/civitai\.com/i.test(t)) return null; // model-page links resolve provider-side
    if (!/\.safetensors(\?|#|$)/i.test(t)) return 'URL should point to a .safetensors file';
    return null;
  }
  if (/^huggingface\.co\//i.test(t) || /^civitai\.com\//i.test(t)) return null;
  if (/^[^/\s]+\/[^/\s]+$/.test(t)) return null; // HF short form owner/repo
  return 'unrecognized format — a full https://….safetensors URL is safest';
}
function validateLoraInput(input) {
  try {
    const group = input.closest('.param-group');
    const warn = group ? group.querySelector('[data-lorawarn]') : null;
    if (!warn) return;
    const toks = (input.tagName === 'TEXTAREA' ? input.value.split(/[\n,]+/) : [input.value]);
    const seen = [];
    toks.map((s) => s.trim()).filter(Boolean).forEach((t) => {
      const iss = loraTokenIssues(t);
      if (iss) {
        const short = t.length > 44 ? t.slice(0, 44) + '…' : t;
        const msg = '\u201c' + short + '\u201d: ' + iss;
        if (seen.indexOf(msg) < 0) seen.push(msg);
      }
    });
    warn.style.display = seen.length ? '' : 'none';
    warn.textContent = seen.length ? '\u26a0 ' + seen.join(' · ') : '';
  } catch {}
}

// ── Multi-LoRA slots: one text box + strength slider (0–2) per LoRA.
// Assembles [{path, scale}] into currentParams so the API gets the right shape.
function escAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function loraSlotCount(spec) {
  const m = /max\s*(\d+)/i.exec((spec && spec.description) || '');
  const n = m ? parseInt(m[1], 10) : 3;
  return Math.min(Math.max(n || 3, 1), 5);
}
function loraSlotPrefill(name) {
  const cur = (typeof currentParams !== 'undefined' && currentParams) ? currentParams[name] : undefined;
  if (Array.isArray(cur)) return cur.map((el) => (el && typeof el === 'object')
    ? { path: el.path || el.url || '', scale: (typeof el.scale === 'number' ? el.scale : 1) }
    : { path: String(el ?? ''), scale: 1 });
  if (typeof cur === 'string' && cur.trim()) return [{ path: cur.trim(), scale: 1 }];
  return [];
}
function renderLoraSlots(name, spec, schema) {
  const n = loraSlotCount(spec);
  const pre = loraSlotPrefill(name);
  let h = `<div class="lora-slots" data-lora-slots="${name}">`;
  for (let i = 0; i < n; i++) {
    const p = pre[i] || { path: '', scale: 1 };
    const sc = Math.min(2, Math.max(0, Number(p.scale) || 0));
    h += `<div class="lora-slot-row">` +
      `<input type="text" class="input" data-param="${name}" data-lora-slot="${i}" value="${escAttr(p.path)}" placeholder="LoRA ${i + 1}: HF owner/repo or https://….safetensors" />` +
      `<div class="lora-scale-row"><span class="lora-scale-label">strength</span>` +
      `<input type="range" data-lora-scale="${i}" min="0" max="2" step="0.05" value="${sc}" />` +
      `<span class="lora-scale-val" data-lora-scaleval="${i}">${sc.toFixed(2)}</span></div></div>`;
  }
  return h + '</div>';
}
function wireLoraSlots(group, name) {
  const box = group.querySelector(`[data-lora-slots="${name}"]`);
  if (!box) return;
  const update = () => {
    const arr = [];
    box.querySelectorAll('[data-lora-slot]').forEach((inp) => {
      const i = inp.dataset.loraSlot;
      const sEl = box.querySelector(`[data-lora-scale="${i}"]`);
      const sc = sEl ? parseFloat(sEl.value) : 1;
      const badge = box.querySelector(`[data-lora-scaleval="${i}"]`);
      if (badge && sEl) badge.textContent = sc.toFixed(2);
      const path = inp.value.trim();
      if (path) arr.push({ path, scale: sc });
    });
    if (typeof currentParams !== 'undefined') {
      if (arr.length) currentParams[name] = arr; else delete currentParams[name];
    }
    if (typeof updatePayloadPreview === 'function') updatePayloadPreview();
    if (typeof debouncedCostEstimate === 'function') debouncedCostEstimate();
  };
  box.querySelectorAll('[data-lora-slot]').forEach((inp) => {
    inp.addEventListener('input', () => { update(); validateLoraInput(inp); });
    validateLoraInput(inp);
  });
  box.querySelectorAll('[data-lora-scale]').forEach((s) => s.addEventListener('input', update));
  update();
}

function renderImageUpload(name, spec, isMulti) {
  const existing = uploadedImages[name];
  if (isMulti) {
    const images = existing || [];
    let thumbsHtml = images.map((url, i) =>
      `<div class="multi-image-thumb"><img src="${url}" alt=""><button class="remove-btn" data-param="${name}" data-idx="${i}"><i class="fas fa-times"></i></button></div>`
    ).join('');
    return `<div class="multi-image-grid" id="imgGrid_${name}">${thumbsHtml}</div>
      <div class="image-upload-zone" data-param="${name}" data-multi="true">
        <div class="upload-placeholder">
          <i class="fas fa-images"></i>
          <p>Add images (up to 9)</p>
        </div>
      </div>
      <div class="url-input-row">
        <input type="url" placeholder="Or paste URL..." id="urlInput_${name}">
        <button class="btn-primary-sm" data-add-url="${name}">Add</button>
        <button class="btn-primary-sm" data-cloud-url="${name}" data-multi="1" title="Pick from R2 storage">☁</button>
      </div>`;
  } else {
    if (existing) {
      return `<div class="image-upload-zone has-image" data-param="${name}">
        <div class="upload-preview">
          <img src="${existing}" alt="Preview">
          <button class="remove-btn" data-param="${name}"><i class="fas fa-times"></i></button>
        </div>
      </div>`;
    }
    return `<div class="image-upload-zone" data-param="${name}">
      <div class="upload-placeholder">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>Click or drag to upload image</p>
      </div>
    </div>
    <div class="url-input-row">
      <input type="url" placeholder="Or paste URL..." id="urlInput_${name}">
      <button class="btn-primary-sm" data-use-url="${name}">Use URL</button>
      <button class="btn-primary-sm" data-cloud-url="${name}" title="Pick from R2 storage">☁</button>
    </div>`;
  }
}

function wireParamEvents(group, name, spec, pType) {
  // Image upload zones
  const zone = group.querySelector(`.image-upload-zone[data-param="${name}"]`);
  if (zone) {
    zone.addEventListener('click', () => openUploadModal(name, pType === 'image_array'));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file, name);
    });
  }

  // URL input
  const useUrlBtn = group.querySelector(`[data-use-url="${name}"]`);
  if (useUrlBtn) {
    useUrlBtn.addEventListener('click', () => {
      const url = group.querySelector(`#urlInput_${name}`)?.value.trim();
      if (url) {
        uploadedImages[name] = url;
        currentParams[name] = url;
        renderParams(currentSchema);
        updatePayloadPreview();
      }
    });
  }

  // Add URL for multi
  const addUrlBtn = group.querySelector(`[data-add-url="${name}"]`);
  if (addUrlBtn) {
    addUrlBtn.addEventListener('click', () => {
      const url = group.querySelector(`#urlInput_${name}`)?.value.trim();
      if (url) {
        if (!uploadedImages[name]) uploadedImages[name] = [];
        uploadedImages[name].push(url);
        currentParams[name] = [...uploadedImages[name]];
        renderParams(currentSchema);
        updatePayloadPreview();
      }
    });
  }

  // Remove buttons
  group.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pName = btn.dataset.param;
      if (btn.dataset.idx !== undefined) {
        uploadedImages[pName].splice(parseInt(btn.dataset.idx), 1);
        currentParams[pName] = [...uploadedImages[pName]];
      } else {
        delete uploadedImages[pName];
        delete currentParams[pName];
      }
      renderParams(currentSchema);
      updatePayloadPreview();
    });
  });

  // Standard inputs (slot inputs manage themselves via wireLoraSlots)
  const input = group.querySelector(`[data-param="${name}"]:not(.image-upload-zone):not([data-lora-slot])`);
  if (input && !zone) {
    const handler = () => {
      let val;
      if (input.type === 'checkbox') {
        val = input.checked;
        input.nextElementSibling.textContent = val ? 'Enabled' : 'Disabled';
      } else if (input.type === 'range') {
        val = parseInt(input.value);
        const rv = document.getElementById(`rv_${name}`);
        if (rv) rv.textContent = val;
      } else if (input.type === 'number') {
        val = input.value ? parseFloat(input.value) : undefined;
      } else {
        val = input.value || undefined;
      }
      if (val !== undefined && val !== '') {
        currentParams[name] = val;
      } else {
        delete currentParams[name];
      }
      updatePayloadPreview();
      debouncedCostEstimate();
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    // Soft LoRA format check — red hint only, never blocks submit.
    if (isLoraParam(name, spec) && (input.tagName === 'TEXTAREA' || input.type === 'text')) {
      input.addEventListener('input', () => validateLoraInput(input));
      validateLoraInput(input);
    }
  }
  wireLoraSlots(group, name);
}

// ── Upload Modal ──
function openUploadModal(paramName, isMulti) {
  uploadTarget = { paramName, isMulti };
  const modal = document.getElementById('uploadModal');
  modal.style.display = 'flex';
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('btnConfirmUpload').classList.add('hidden');
  document.getElementById('imageUrlInput').value = '';
  document.getElementById('fileInput').value = '';
}

function closeUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
  uploadTarget = null;
}

async function uploadFile(file, paramName) {
  const status = document.getElementById('uploadStatus');
  const preview = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('uploadPreviewImg');

  // Show local preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    preview.classList.remove('hidden');
    status.textContent = 'Uploading...';
  };
  reader.readAsDataURL(file);

  // Upload to R2 staging (preview + preservation; paste public URLs for generation)
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.url) {
      status.textContent = 'Upload complete!';
      status.className = 'text-xs text-green-400 mt-2';
      document.getElementById('btnConfirmUpload').classList.remove('hidden');
      document.getElementById('btnConfirmUpload').onclick = () => {
        if (uploadTarget.isMulti) {
          if (!uploadedImages[paramName]) uploadedImages[paramName] = [];
          uploadedImages[paramName].push(data.url);
          currentParams[paramName] = [...uploadedImages[paramName]];
        } else {
          uploadedImages[paramName] = data.url;
          currentParams[paramName] = data.url;
        }
        closeUploadModal();
        renderParams(currentSchema);
        updatePayloadPreview();
      };
    } else {
      status.textContent = 'Upload failed: ' + (data.error || 'Unknown error');
      status.className = 'text-xs text-red-400 mt-2';
    }
  } catch (e) {
    status.textContent = 'Upload error: ' + e.message;
    status.className = 'text-xs text-red-400 mt-2';
  }
}

// ── Model Details ──
function renderModelDetails() {
  const el = document.getElementById('modelDetails');
  if (!currentModel) { el.innerHTML = '<p class="text-xs text-gray-600">Select a model.</p>'; return; }

  let html = `
    <div class="mb-3">
      <div class="text-sm font-medium text-gray-200 mb-1">${currentModel.id}</div>
      <div class="text-xs text-gray-500">${currentModel.description || 'No description available.'}</div>
    </div>
    <div class="space-y-2 text-xs">
      <div class="flex justify-between"><span class="text-gray-500">Category</span><span class="text-gray-300">${currentModel.category}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Family</span><span class="text-gray-300">${currentModel.family || 'N/A'}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Cost</span><span class="text-gray-300">${currentModel.cost > 0 ? '$' + currentModel.cost : 'Free'}${currentModel.dynamic_pricing ? ' (dynamic)' : ''}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Type</span><span class="text-gray-300">${currentModel.group_of || 'N/A'}</span></div>
    </div>`;

  if (currentSchema) {
    const paramNames = Object.keys(currentSchema.params).filter(n => n !== 'prompt');
    if (paramNames.length > 0) {
      html += `<div class="mt-3 pt-3 border-t border-gray-800">
        <div class="text-xs text-gray-500 mb-2">Parameters (${paramNames.length})</div>
        <div class="flex flex-wrap gap-1">${paramNames.map(n =>
          `<span class="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-400">${n}</span>`
        ).join('')}</div>
      </div>`;
    }
  }

  el.innerHTML = html;
}

// ── Update payload preview ──
function updatePayloadPreview() {
  const prompt = document.getElementById('promptInput').value || '';
  const payload = { prompt, ...currentParams };
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete payload[k];
  }
  document.getElementById('payloadPreview').textContent = JSON.stringify(payload, null, 2);
  document.getElementById('charCount').textContent = `${prompt.length} chars`;
}

// ── Cost Estimate ──
let costEstimateTimer = null;
function debouncedCostEstimate() {
  clearTimeout(costEstimateTimer);
  costEstimateTimer = setTimeout(updateCostEstimate, 800);
}

async function updateCostEstimate() {
  if (!currentModel) return;
  const bar = document.getElementById('costBar');
  const val = document.getElementById('costValue');

  // Simple: show catalog cost
  if (currentModel.cost > 0) {
    val.textContent = `~$${currentModel.cost}`;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }

  // TODO: call /api/estimate for dynamic pricing models
}

// Error text helper: WaveSpeed returns {code, message, data}.
// String(obj) renders "[object Object]" — extract or serialize instead.
function errText(v, fallback){
  if (typeof v === 'string' && v) return v;
  if (v && typeof v === 'object') {
    if (typeof v.message === 'string' && v.message) return v.message;
    if (typeof v.error === 'string' && v.error) return v.error;
    if (v.error && typeof v.error === 'object') {
      const inner = errText(v.error, '');
      if (inner) return inner;
    }
    try { return JSON.stringify(v).slice(0, 500); } catch { return fallback; }
  }
  return fallback;
}

// ── Generate ──
async function generate() {
  if (!currentModel) return;
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { document.getElementById('promptInput').focus(); return; }

  const btn = document.getElementById('btnGenerate');
  const btnText = document.getElementById('genBtnText');
  const btnSpin = document.getElementById('genBtnSpinner');
  btn.disabled = true;
  btnText.classList.add('hidden');
  btnSpin.classList.remove('hidden');

    showStatus('Submitting...', 'Sending to WaveSpeed', true);
  hideOutput();

  const params = { prompt, ...currentParams };
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete params[k];
  }
  // lora_list/loras must be [{path, scale}] — wrap pasted URL strings so
  // WaveSpeed validation is strict - params come schema-filtered from the Worker.
  // Paste clean https:// URLs — WaveSpeed fetches inputs server-side,
  // restore the scheme automatically.
  const fixLoraUrl = (u) => {
    let s = String(u ?? '').trim();
    if (/^huggingface\.co\//i.test(s)) s = 'https://' + s;
    return s;
  };
  for (const k of ['lora_list', 'loras']) {
    if (params[k] === undefined) continue;
    let arr;
    if (Array.isArray(params[k])) arr = params[k];
    else {
      const t = String(params[k]).trim();
      let j = null;
      // Already-serialized JSON (e.g. pasted from the picker's copied Fill
      // value) — parse it, don't split on commas.
      if (/^[\[{]/.test(t)) { try { j = JSON.parse(t); } catch {} }
      arr = Array.isArray(j) ? j : (j && typeof j === 'object' ? [j] : t.split(/[\n,]+/).map(s => s.trim()).filter(Boolean));
    }
    const norm = arr.map(el => (el && typeof el === 'object')
      ? { path: fixLoraUrl(el.path || el.url || ''), scale: typeof el.scale === 'number' ? el.scale : 1 }
      : { path: fixLoraUrl(el), scale: 1 }).filter(o => o.path);
    if (norm.length) params[k] = norm; else delete params[k];
  }

  try {
    const res = await fetch(`${API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: currentModel.id, params, enhancementId: window.lastEnhancementId || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg = errText(data.message, '') || errText(data.error, '') || errText(data.details?.detail, '') || `Generation failed (${res.status})`;
      throw new Error(errMsg);
    }
    if (data.requestId && window.lastEnhancementId) {
      // Link run → enhancement in shared history (fire-and-forget)
      fetch(`${API}/history/link`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'wavespeed', external_job_id: data.requestId, enhancement_id: window.lastEnhancementId }) }).catch(() => {});
      window.lastEnhancementId = null;
    }

    showStatus('Processing...', `ID: ${data.requestId}`, true);
    pollForResult(data.requestId, data.cost);
  } catch (e) {
    showStatus('Error', `${e.message} [model: ${currentModel?.id || 'none'}]`, false);
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnSpin.classList.add('hidden');
  }
}

function pollForResult(requestId, initialCost) {
  const startTime = Date.now();
  const MAX_POLL_MS = 15 * 60 * 1000; // stop polling after 15m — job is stuck/queued server-side
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/predictions/${requestId}`);
      const data = await res.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (Date.now() - startTime > MAX_POLL_MS) {
        clearInterval(pollTimer);
        showStatus('Still running', `No result after 15m — job is likely queued or stuck server-side. ID: ${requestId} — check it at wavespeed.ai/history. Browser stopped polling; nothing was charged unless it completes.`, false);
        resetGenButton();
        return;
      }
      if (data.status === 'completed') {
        clearInterval(pollTimer);
        showStatus('Completed', `Done in ${elapsed}s`, false);
        window.lastWsJob = requestId;
        showOutput(data.outputs, initialCost, elapsed);
        addToHistory(requestId, data.outputs, initialCost, elapsed);
        resetGenButton();
      } else if (data.status === 'failed') {
        clearInterval(pollTimer);
        showStatus('Failed', `${errText(data.error, 'Generation failed')} [id: ${requestId} | model: ${currentModel?.id || 'unknown'}]`, false);
        resetGenButton();
      } else {
        const pct = data.status === 'processing' ? 60 : data.status === 'queued' ? 20 : 40;
        showStatus(capitalize(data.status), `${elapsed}s elapsed`, true);
        updateProgress(pct);
      }
    } catch (e) { /* keep polling */ }
  }, 2500);
}

function resetGenButton() {
  const btn = document.getElementById('btnGenerate');
  btn.disabled = false;
  document.getElementById('genBtnText').classList.remove('hidden');
  document.getElementById('genBtnSpinner').classList.add('hidden');
}

// ── UI Helpers ──
function showStatus(text, detail, showSpinner) {
  const card = document.getElementById('statusCard');
  card.classList.remove('hidden');
  document.getElementById('statusText').textContent = text;
  document.getElementById('statusDetail').textContent = detail;
  document.getElementById('statusSpinner').classList.toggle('hidden', !showSpinner);
  document.getElementById('progressWrap').classList.toggle('hidden', !showSpinner);
}

function updateProgress(pct) {
  document.getElementById('progressBar').style.width = `${pct}%`;
}

function hideOutput() {
  document.getElementById('outputCard').classList.add('hidden');
  document.getElementById('outputContent').innerHTML = '';
}

function showOutput(outputs, cost, elapsed) {
  if (!outputs?.length) return;
  const card = document.getElementById('outputCard');
  card.classList.remove('hidden');
  const content = document.getElementById('outputContent');
  const meta = document.getElementById('outputMeta');
  const url = outputs[0];
  const isVideo = url.match(/\.(mp4|webm|mov)$/i) || url.includes('video');

  if (isVideo) {
    content.innerHTML = `<video src="${url}" controls autoplay loop class="max-w-full max-h-[500px] rounded-xl"></video>`;
  } else {
    content.innerHTML = `<img src="${url}" alt="Generated" class="max-w-full max-h-[500px] rounded-xl">`;
  }

  const costStr = cost?.amount_usd ? `$${cost.amount_usd.toFixed(4)}` : 'N/A';
  meta.innerHTML = `
    <span><i class="fas fa-clock"></i> ${elapsed}s</span>
    <span><i class="fas fa-dollar-sign"></i> ${costStr}</span>
    <span><i class="fas fa-images"></i> ${outputs.length} output${outputs.length > 1 ? 's' : ''}</span>
    <span id="muRateRow">rate: ${[1,2,3,4,5].map(i => `<button data-mrate="${i}" style="color:#52525b" title="rate ${i}">★</button>`).join('')}</span>`;
  card.dataset.url = url;
  meta.querySelectorAll('[data-mrate]').forEach((b) => b.addEventListener('click', () => rateWsJob(Number(b.dataset.mrate))));
}

// Rate the last completed WaveSpeed job 1-5 into shared history
async function rateWsJob(n) {
  const jobId = window.lastWsJob || '';
  if (!jobId) { showToast('No job to rate yet', 'error'); return; }
  try {
    const r = await fetch(`${API}/history/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'wavespeed', external_job_id: jobId, rating: n }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    showToast(`Rated ${n}★ — saved to shared history`, 'success');
    document.querySelectorAll('#muRateRow [data-mrate]').forEach((b) => { b.style.color = Number(b.dataset.mrate) <= n ? '#fbbf24' : '#52525b'; });
  } catch (e) { showToast('Rate failed: ' + e.message, 'error'); }
}

function addToHistory(requestId, outputs, cost, elapsed) {
  const url = outputs?.[0];
  if (!url) return;
  history.unshift({ requestId, url, cost: cost?.amount_usd, elapsed, model: currentModel?.id, time: new Date().toLocaleTimeString() });
  if (history.length > 30) history.pop();
  saveHistory();
  renderHistory();
  // Auto-save outputs to R2 (genai-assets) so expiring WaveSpeed CDN URLs stay
  // linked in shared history — runs in background, status shown in output meta.
  try {
    const urls = (outputs || []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10);
    if (urls.length) {
      const meta = document.getElementById('outputMeta');
      const span = document.createElement('span');
      span.id = 'archStatus';
      span.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> archiving…';
      if (meta) meta.appendChild(span);
      fetch(`${API}/wavespeed/save-outputs`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, model: currentModel?.id, jobId: requestId }) })
        .then((r) => r.json().catch(() => ({})))
        .then((j) => {
          const ok = (j.saved || []).length;
          if (span) span.innerHTML = ok ? `<i class="fas fa-cloud"></i> archived ✓ (${ok}/${urls.length})` : '<i class="fas fa-exclamation-triangle"></i> archive failed';
          if (!ok && typeof showToast === 'function') showToast('R2 auto-archive failed — CDN link will expire!', 'error');
        })
        .catch(() => { if (span) span.innerHTML = '<i class="fas fa-exclamation-triangle"></i> archive failed'; });
    }
  } catch {}
}

function renderHistory() {
  const grid = document.getElementById('historyGrid');
  if (history.length === 0) { grid.innerHTML = '<p class="text-xs text-gray-600 col-span-full py-8 text-center">No generations yet.</p>'; return; }
  grid.innerHTML = history.slice(0, 20).map((h, i) => {
    const isVideo = h.url.match(/\.(mp4|webm|mov)$/i);
    if (isVideo) {
      return `<div class="history-thumb" data-idx="${i}"><div class="w-full h-full bg-gray-900 flex items-center justify-center"><i class="fas fa-video text-gray-700"></i></div><div class="overlay"><i class="fas fa-play"></i></div></div>`;
    }
    return `<div class="history-thumb" data-idx="${i}"><img src="${h.url}" alt="" loading="lazy"><div class="overlay"><i class="fas fa-expand"></i></div></div>`;
  }).join('');

  grid.querySelectorAll('.history-thumb').forEach(el => {
    el.addEventListener('click', () => { const h = history[el.dataset.idx]; if (h) window.open(h.url, '_blank'); });
  });
}

function saveHistory() { try { localStorage.setItem('ws_history', JSON.stringify(history.slice(0, 30))); } catch (e) {} }
function loadHistory() { try { history = JSON.parse(localStorage.getItem('ws_history') || '[]'); renderHistory(); } catch (e) { history = []; } }

function setConnectionStatus(ok) {
  const dot = document.getElementById('connectionDot');
  dot.className = `w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ── Templates ──
function renderTemplates() {
  const panel = document.getElementById('templatesPanel');
  const list = document.getElementById('templatesList');
  list.innerHTML = TEMPLATES.map(t =>
    `<button class="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 transition-colors text-left" data-template="${t.name}">
      <i class="fas ${t.icon} text-purple-400 w-5 text-center"></i>
      <span class="text-sm text-gray-300">${t.name}</span>
    </button>`
  ).join('');

  list.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = TEMPLATES.find(x => x.name === btn.dataset.template);
      if (!t) return;
      document.getElementById('promptInput').value = t.prompt;
      if (t.model) selectModel(t.model);
      if (t.params) Object.assign(currentParams, t.params);
      updatePayloadPreview();
      panel.classList.add('hidden');
    });
  });
}

// ── Saved Prompts ──
function saveCurrentPrompt() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) return;
  const saved = JSON.parse(localStorage.getItem('ws_saved') || '[]');
  saved.unshift({ prompt, model: currentModel?.id, params: { ...currentParams }, time: new Date().toISOString() });
  if (saved.length > 50) saved.pop();
  localStorage.setItem('ws_saved', JSON.stringify(saved));
  renderSavedPrompts();
}

function renderSavedPrompts() {
  const panel = document.getElementById('savedPanel');
  const list = document.getElementById('savedList');
  const saved = JSON.parse(localStorage.getItem('ws_saved') || '[]');
  if (saved.length === 0) { list.innerHTML = '<p class="text-xs text-gray-600 py-4 text-center">No saved prompts.</p>'; return; }
  list.innerHTML = saved.map((s, i) =>
    `<div class="p-2 rounded-lg bg-gray-900/50 cursor-pointer hover:bg-gray-800/50 transition-colors" data-saved="${i}">
      <div class="text-xs text-gray-300 truncate">${s.prompt.substring(0, 80)}...</div>
      <div class="text-[10px] text-gray-600 mt-1">${s.model || 'N/A'} &middot; ${new Date(s.time).toLocaleDateString()}</div>
    </div>`
  ).join('');

  list.querySelectorAll('[data-saved]').forEach(el => {
    el.addEventListener('click', () => {
      const s = saved[el.dataset.saved];
      if (!s) return;
      document.getElementById('promptInput').value = s.prompt;
      if (s.model) selectModel(s.model);
      if (s.params) { Object.assign(currentParams, s.params); }
      updatePayloadPreview();
      panel.classList.add('hidden');
    });
  });
}

// ── Event Listeners ──
function setupEventListeners() {
  // Category tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentGroup = tab.dataset.group;
      filterByGroup();
    });
  });

  // Update / sync models
  document.getElementById('btnSync')?.addEventListener('click', syncCatalog);

  // Model search
  const search = document.getElementById('modelSearch');
  const dropdown = document.getElementById('modelDropdown');

  search.addEventListener('focus', () => dropdown.classList.remove('hidden'));
  search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    dropdown.querySelectorAll('.model-dropdown-item').forEach(item => {
      const name = item.dataset.id.toLowerCase();
      item.style.display = name.includes(q) ? '' : 'none';
    });
    dropdown.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#modelSelectorWrap')) dropdown.classList.add('hidden');
  });

  // Prompt input
  document.getElementById('promptInput').addEventListener('input', updatePayloadPreview);

  // Generate
  document.getElementById('btnGenerate').addEventListener('click', generate);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generate(); } });

  // Clear
  document.getElementById('btnClear')?.addEventListener('click', () => {
    document.getElementById('promptInput').value = '';
    updatePayloadPreview();
  });

  // Enhance
  document.getElementById('btnEnhance')?.addEventListener('click', () => {
    const p = document.getElementById('promptInput').value;
    if (p) { document.getElementById('promptInput').value = p + ', ultra-detailed, high quality, sharp focus, 8k'; updatePayloadPreview(); }
  });

  // Save prompt
  document.getElementById('btnSavePrompt')?.addEventListener('click', saveCurrentPrompt);

  // Templates
  document.getElementById('btnTemplates')?.addEventListener('click', () => {
    const panel = document.getElementById('templatesPanel');
    panel.classList.toggle('hidden');
    document.getElementById('savedPanel').classList.add('hidden');
    if (!panel.classList.contains('hidden')) renderTemplates();
  });

  // Saved prompts
  document.getElementById('btnSavedPrompts')?.addEventListener('click', () => {
    const panel = document.getElementById('savedPanel');
    panel.classList.toggle('hidden');
    document.getElementById('templatesPanel').classList.add('hidden');
    if (!panel.classList.contains('hidden')) renderSavedPrompts();
  });

  // Copy buttons
  document.getElementById('btnCopyUrl')?.addEventListener('click', () => {
    const url = document.getElementById('outputCard')?.dataset.url;
    if (url) navigator.clipboard.writeText(url);
  });
  document.getElementById('btnDownload')?.addEventListener('click', () => {
    const url = document.getElementById('outputCard')?.dataset.url;
    if (url) window.open(url, '_blank');
  });
  document.getElementById('btnOpenNew')?.addEventListener('click', () => {
    const url = document.getElementById('outputCard')?.dataset.url;
    if (url) window.open(url, '_blank');
  });
  document.getElementById('btnCopyPayload')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('payloadPreview').textContent);
  });

  // Upload modal - use getElementById for reliability
  const closeBtn = document.getElementById('closeUploadModal');
  const cancelBtn = document.getElementById('btnCancelUpload');
  const backdrop = document.getElementById('uploadBackdrop');
  const confirmBtn = document.getElementById('btnConfirmUpload');

  if (closeBtn) closeBtn.addEventListener('click', closeUploadModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeUploadModal);
  if (backdrop) backdrop.addEventListener('click', closeUploadModal);

  // File input - direct reference
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && uploadTarget) {
        uploadFile(file, uploadTarget.paramName);
      }
    });
  }

  // Use URL button
  const useUrlBtn = document.getElementById('btnUseUrl');
  if (useUrlBtn) {
    useUrlBtn.addEventListener('click', () => {
      const urlInput = document.getElementById('imageUrlInput');
      const url = urlInput ? urlInput.value.trim() : '';
      if (url && uploadTarget) {
        if (uploadTarget.isMulti) {
          if (!uploadedImages[uploadTarget.paramName]) uploadedImages[uploadTarget.paramName] = [];
          uploadedImages[uploadTarget.paramName].push(url);
          currentParams[uploadTarget.paramName] = [...uploadedImages[uploadTarget.paramName]];
        } else {
          uploadedImages[uploadTarget.paramName] = url;
          currentParams[uploadTarget.paramName] = url;
        }
        closeUploadModal();
        renderParams(currentSchema);
        updatePayloadPreview();
      }
    });
  }

  // Cloud picker (R2) button in upload modal
  const cloudBtn = document.getElementById('btnCloudPick');
  if (cloudBtn) {
    cloudBtn.addEventListener('click', () => {
      if (!uploadTarget) return;
      openCloudPicker((url) => cloudApplyToUploadModal(url));
    });
  }

  // Cloud picker buttons on per-param URL rows (single + multi). Delegated —
  // rows re-render often, so a single document listener covers them all.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cloud-url]');
    if (!b) return;
    const name = b.dataset.cloudUrl;
    const isMulti = b.dataset.multi === '1';
    if (!name) return;
    openCloudPicker((url) => cloudApplyToParam(name, isMulti, url));
  });

  // Drop zone in modal
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && uploadTarget) uploadFile(file, uploadTarget.paramName);
    });
  }
}

// ── Cloud storage picker ──
// Browse the shared R2 bucket (genai-assets) as an input source alongside
// local files. Picking resolves the key server-side into a presigned URL
// WaveSpeed's servers can fetch, then applies it like a pasted URL.
const cloudPicker = { prefix: '', flat: false, filter: 'all', folders: [], objects: [], cursor: null, truncated: false, selected: null, onPick: null, shown: 48 };
function cloudKind(key) {
  const m = String(key || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const e = m ? m[1] : '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp'].includes(e)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(e)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(e)) return 'audio';
  return 'other';
}
function cloudFileUrl(key) { return '/api/cloud/file?key=' + encodeURIComponent(key); }
function cloudBaseName(key) { const p = String(key || '').split('/'); return p[p.length - 1] || key; }
function cloudFmtSize(b) {
  b = Number(b || 0);
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function cloudEsc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ensureCloudModal() {
  if (document.getElementById('cloudModal')) return;
  if (!document.getElementById('cloudPickerCss')) {
    const st = document.createElement('style');
    st.id = 'cloudPickerCss';
    st.textContent = '.cloud-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.5rem;overflow-y:auto;padding:.25rem;min-height:200px;max-height:46vh}' +
      '.cloud-card{background:#1f2937;border:1px solid #374151;border-radius:.5rem;overflow:hidden;cursor:pointer}' +
      '.cloud-card:hover{border-color:#10b981}.cloud-card.sel{border-color:#10b981;box-shadow:0 0 0 1px #10b981}' +
      '.cloud-thumb{width:100%;height:130px;object-fit:cover;display:block;background:#030712}' +
      '.cloud-folder{display:flex;align-items:center;justify-content:center;height:130px;font-size:1.8rem;background:#030712}' +
      '.cloud-meta{padding:.3rem .45rem;font-size:.68rem;color:#d1d5db}' +
      '.cloud-ph{animation:cloudpulse 1.4s ease-in-out infinite}' +
      '@keyframes cloudpulse{0%,100%{opacity:.45}50%{opacity:.95}}';
    document.head.appendChild(st);
  }
  document.body.insertAdjacentHTML('beforeend',
    '<div id="cloudModal" style="display:none;position:fixed;inset:0;z-index:300;align-items:center;justify-content:center;background:rgba(0,0,0,.72)">' +
    '<div style="background:#111827;border:1px solid #374151;border-radius:.75rem;width:94vw;max-width:880px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden">' +
    '<div class="flex items-center gap-2 px-4 py-3" style="border-bottom:1px solid #374151"><span class="font-semibold">☁ R2 storage</span><span id="cloudCount" class="text-xs" style="color:#9ca3af"></span><span class="flex-1"></span><button id="cloudClose" class="btn-secondary" type="button">✕</button></div>' +
    '<div class="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"><div id="cloudCrumbs" class="flex items-center gap-1 text-sm"></div><span class="flex-1"></span>' +
    '<select id="cloudFilter" class="input" style="width:auto;padding:.2rem .4rem"><option value="all">All</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="other">Other</option></select>' +
    '<button id="cloudFlat" class="btn-secondary" type="button" title="Flat view: everything below, no digging">⤵ Flat</button></div>' +
    '<div id="cloudGrid" class="cloud-grid"></div>' +
    '<div class="flex flex-wrap items-center gap-2 px-4 py-3 text-sm" style="border-top:1px solid #374151"><span id="cloudSel" class="truncate" style="max-width:55%;color:#9ca3af">select a file…</span><span id="cloudStatus" class="text-xs" style="color:#9ca3af"></span><span class="flex-1"></span>' +
    '<button id="cloudCancel" class="btn-secondary" type="button">Cancel</button><button id="cloudUse" class="btn-primary-sm" type="button" disabled>Use this file</button></div>' +
    '</div></div>');
  document.getElementById('cloudClose').addEventListener('click', closeCloudPicker);
  document.getElementById('cloudCancel').addEventListener('click', closeCloudPicker);
  document.getElementById('cloudFlat').addEventListener('click', () => {
    cloudPicker.flat = !cloudPicker.flat;
    document.getElementById('cloudFlat').style.borderColor = cloudPicker.flat ? '#10b981' : '';
    cloudLoad(false);
  });
  document.getElementById('cloudFilter').addEventListener('change', (e) => { cloudPicker.filter = e.target.value; cloudPicker.shown = 48; cloudRender(); });
  document.getElementById('cloudCrumbs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-crumb]');
    if (b) { cloudPicker.prefix = b.dataset.crumb; cloudLoad(false); }
  });
  document.getElementById('cloudUse').addEventListener('click', cloudResolveSelected);
}
function openCloudPicker(onPick) {
  ensureCloudModal();
  Object.assign(cloudPicker, { prefix: '', flat: false, folders: [], objects: [], cursor: null, truncated: false, selected: null, shown: 48, onPick });
  document.getElementById('cloudFilter').value = 'all';
  cloudPicker.filter = 'all';
  document.getElementById('cloudFlat').style.borderColor = '';
  document.getElementById('cloudModal').style.display = 'flex';
  cloudLoad(false);
}
function closeCloudPicker() {
  const m = document.getElementById('cloudModal');
  if (m) m.style.display = 'none';
  cloudPicker.onPick = null;
}
async function cloudLoad(more) {
  const st = cloudPicker;
  cloudStatus('loading…');
  try {
    let q = '/api/cloud/list?prefix=' + encodeURIComponent(st.prefix) + (st.flat ? '&recursive=1' : '&delimiter=/');
    if (more && st.cursor) q += '&cursor=' + encodeURIComponent(st.cursor);
    const r = await fetch(q);
    if (r.status === 401) throw new Error('Access login required.');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    st.folders = j.folders || [];
    st.objects = more ? st.objects.concat(j.objects || []) : (j.objects || []);
    st.truncated = !!j.truncated;
    st.cursor = j.cursor || null;
    if (!more) st.shown = 48;
    cloudStatus('');
    cloudRender();
  } catch (e) { cloudStatus('error: ' + e.message); }
}
function cloudStatus(t) { const el = document.getElementById('cloudStatus'); if (el) el.textContent = t || ''; }
function cloudRender() {
  const st = cloudPicker;
  const grid = document.getElementById('cloudGrid');
  const segs = st.prefix.split('/').filter(Boolean);
  let crumbs = '<button class="btn-secondary" data-crumb="">root</button>';
  let acc = '';
  segs.forEach((s) => { acc += s + '/'; crumbs += ' / <button class="btn-secondary" data-crumb="' + cloudEsc(acc) + '">' + cloudEsc(s) + '</button>'; });
  document.getElementById('cloudCrumbs').innerHTML = crumbs;
  const all = st.objects.filter((o) => st.filter === 'all' || cloudKind(o.key) === st.filter);
  const files = all.slice(0, st.shown);
  const folders = (st.filter === 'all' && !st.flat) ? st.folders : [];
  document.getElementById('cloudCount').textContent = st.objects.length + ' files' + (st.flat ? ' (flat)' : '');
  let html = '';
  folders.forEach((f) => {
    const nm = f.slice(0, -1).split('/').pop() + '/';
    html += '<div class="cloud-card" data-folder="' + cloudEsc(f) + '"><div class="cloud-folder">📁</div><div class="cloud-meta"><div class="truncate">' + cloudEsc(nm) + '</div></div></div>';
  });
  files.forEach((o) => {
    const kind = cloudKind(o.key), u = cloudFileUrl(o.key);
    let thumb;
    if (kind === 'image') thumb = '<img class="cloud-thumb cloud-ph" data-thumb data-src="' + u + '" alt="" />';
    else if (kind === 'video') thumb = '<div class="cloud-folder cloud-ph" data-thumb>🎬</div>';
    else thumb = '<div class="cloud-folder">' + (kind === 'audio' ? '🎵' : '📄') + '</div>';
    html += '<div class="cloud-card' + (st.selected === o.key ? ' sel' : '') + '" data-key="' + cloudEsc(o.key) + '" data-kind="' + kind + '">' + thumb +
      '<div class="cloud-meta"><div class="truncate" title="' + cloudEsc(o.key) + '">' + cloudEsc(cloudBaseName(o.key)) + '</div><div style="color:#6b7280">' + cloudFmtSize(o.size) + '</div></div></div>';
  });
  if (!folders.length && !files.length) html += '<div class="text-sm" style="color:#6b7280">empty</div>';
  if (all.length > files.length) html += '<div style="grid-column:1/-1"><button class="btn-secondary" id="cloudShowMore" type="button">Show more (' + files.length + ' of ' + all.length + ')…</button></div>';
  if (st.truncated) html += '<div style="grid-column:1/-1"><button class="btn-secondary" id="cloudFetchMore" type="button">Load more from storage…</button></div>';
  grid.innerHTML = html;
  cloudObserve(grid);
}
document.addEventListener('click', (e) => {
  const more = e.target.closest('#cloudShowMore');
  if (more) { cloudPicker.shown += 48; cloudRender(); return; }
  const fetch = e.target.closest('#cloudFetchMore');
  if (fetch) { cloudLoad(true); return; }
  const f = e.target.closest('#cloudGrid [data-folder]');
  if (f) { cloudPicker.prefix = f.dataset.folder; cloudLoad(false); return; }
  const c = e.target.closest('#cloudGrid [data-key]');
  if (c) {
    cloudPicker.selected = c.dataset.key;
    document.querySelectorAll('#cloudGrid .cloud-card.sel').forEach((x) => x.classList.remove('sel'));
    c.classList.add('sel');
    document.getElementById('cloudSel').textContent = c.dataset.key;
    document.getElementById('cloudUse').disabled = false;
  }
});
async function cloudResolveSelected() {
  const key = cloudPicker.selected;
  if (!key) return;
  const btn = document.getElementById('cloudUse');
  btn.disabled = true;
  cloudStatus('resolving…');
  try {
    const r = await fetch('/api/cloud/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error || ('HTTP ' + r.status));
    cloudStatus('ready ✓ (' + (j.via || 'ok') + (j.expiresIn ? ', link valid ' + Math.round(j.expiresIn / 3600) + 'h' : '') + ')');
    const cb = cloudPicker.onPick;
    if (cb) cb(j.url, key);
  } catch (e) { cloudStatus('resolve failed: ' + e.message); btn.disabled = false; }
}
const cloudThumbObs = ('IntersectionObserver' in window) ? new IntersectionObserver((ents) => {
  for (const en of ents) { if (en.isIntersecting) { cloudThumbObs.unobserve(en.target); cloudLoadThumb(en.target); } }
}, { rootMargin: '200px' }) : null;
const cloudThumbQueue = [];
let cloudThumbActive = 0;
function cloudPump() {
  let n = cloudThumbQueue.length;
  while (cloudThumbActive < 3 && cloudThumbQueue.length && n-- > 0) {
    const job = cloudThumbQueue.shift();
    if (!job.el.isConnected) continue;
    try {
      const r = job.el.getBoundingClientRect();
      if (r.bottom < -400 || r.top > (window.innerHeight + 400)) { job.tries = (job.tries || 0) + 1; if (job.tries < 15) cloudThumbQueue.push(job); continue; }
    } catch {}
    cloudThumbActive++;
    job.el.dataset.done = '1';
    cloudCapture(job.el).catch(() => {}).finally(() => { cloudThumbActive--; cloudPump(); });
  }
}
function cloudObserve(root) {
  const els = root.querySelectorAll('[data-thumb]:not([data-done])');
  if (!cloudThumbObs) { els.forEach(cloudLoadThumb); return; }
  els.forEach((el) => cloudThumbObs.observe(el));
}
function cloudLoadThumb(el) {
  if (!el || el.dataset.done) return;
  const card = el.closest('[data-kind]');
  const kind = card ? card.dataset.kind : '';
  const key = card ? card.dataset.key : '';
  if (!key) return;
  if (kind === 'image') {
    if (el.tagName === 'IMG') {
      el.dataset.done = '1';
      el.addEventListener('load', () => el.classList.remove('cloud-ph'), { once: true });
      el.addEventListener('error', () => el.classList.remove('cloud-ph'), { once: true });
      el.src = el.dataset.src;
    }
    return;
  }
  if (kind === 'video') { cloudThumbQueue.push({ el, tries: 0 }); cloudPump(); }
}
async function cloudCapture(el) {
  const card = el.closest('[data-kind]');
  const key = card ? card.dataset.key : '';
  if (!key || !el.isConnected) return;
  const url = cloudFileUrl(key);
  const dataUrl = await new Promise((resolve) => {
    let done = false;
    const finish = (d) => { if (done) return; done = true; try { v.removeAttribute('src'); v.load(); } catch {} resolve(d || null); };
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
    const to = setTimeout(() => finish(null), 10000);
    const grab = () => {
      if (done) return; clearTimeout(to);
      let out = null;
      try {
        const w = v.videoWidth, h = v.videoHeight;
        if (w && h) {
          const s = Math.min(1, 240 / w);
          const c = document.createElement('canvas');
          c.width = Math.max(2, Math.round(w * s)); c.height = Math.max(2, Math.round(h * s));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', 0.7);
        }
      } catch {}
      finish(out);
    };
    v.addEventListener('loadeddata', () => {
      try {
        const t = (Number.isFinite(v.duration) && v.duration > 1) ? Math.min(0.5, v.duration / 3) : 0;
        if (t > 0.05) { v.addEventListener('seeked', grab, { once: true }); try { v.currentTime = t; } catch { grab(); } setTimeout(grab, 4000); }
        else grab();
      } catch { grab(); }
    }, { once: true });
    v.addEventListener('error', () => { clearTimeout(to); finish(null); }, { once: true });
  });
  if (!el.isConnected) return;
  if (dataUrl) {
    const img = document.createElement('img');
    img.className = 'cloud-thumb'; img.alt = ''; img.src = dataUrl;
    el.replaceWith(img);
  } else { el.classList.remove('cloud-ph'); }
}
// Apply a resolved cloud URL to the upload modal's target param.
function cloudApplyToUploadModal(url) {
  if (!uploadTarget) return;
  const nm = uploadTarget.paramName;
  document.getElementById('uploadPreviewImg').src = url;
  document.getElementById('uploadPreview').classList.remove('hidden');
  const st = document.getElementById('uploadStatus');
  st.textContent = 'Cloud file ready ✓ (presigned link, valid 24h — generate promptly)';
  st.className = 'text-xs text-green-400 mt-2';
  const c = document.getElementById('btnConfirmUpload');
  c.classList.remove('hidden');
  c.onclick = () => {
    if (uploadTarget.isMulti) {
      if (!uploadedImages[nm]) uploadedImages[nm] = [];
      uploadedImages[nm].push(url);
      currentParams[nm] = [...uploadedImages[nm]];
    } else { uploadedImages[nm] = url; currentParams[nm] = url; }
    closeCloudPicker();
    closeUploadModal();
    renderParams(currentSchema);
    updatePayloadPreview();
  };
}
// Apply a resolved cloud URL straight to a per-param URL row.
function cloudApplyToParam(name, isMulti, url) {
  if (!name) return;
  if (isMulti) {
    if (!uploadedImages[name]) uploadedImages[name] = [];
    uploadedImages[name].push(url);
    currentParams[name] = [...uploadedImages[name]];
  } else { uploadedImages[name] = url; currentParams[name] = url; }
  closeCloudPicker();
  renderParams(currentSchema);
  updatePayloadPreview();
}
