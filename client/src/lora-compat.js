// LoRA ↔ model compatibility — single source of truth for intelligent filtering.
// Tiers:
//   verified (green): the exact LoRA+model pair completed a real run (VERIFIED_LORA_RUNS).
//   likely (yellow): suspected compatible — curated exact target, same family +
//     pipeline, tolerating minor version drift (wan 2.1 vs 2.2).
//   no (red): incompatible — family mismatch, pipeline mismatch, or a major
//     version gap (wan 2.x vs 3.x). Hidden unless the picker’s show-all is on.
import { VERIFIED_LORA_RUNS } from './loras-data.js';

export function loraFamily(l) {
  const b = String(l?.base_model || '');
  if (/flux/i.test(b)) return 'FLUX.1';
  if (/qwen/i.test(b)) return 'Qwen-Image';
  if (/krea/i.test(b)) return 'Krea';
  if (/wan[-\s_]?2\.1/i.test(b)) return 'Wan 2.1';
  if (/wan[-\s_]?2\.2/i.test(b)) return 'Wan 2.2';
  if (/wan/i.test(b)) return 'Wan (other)';
  return 'Other / unstamped';
}

// NOTE: flux check comes before krea — flux-krea-dev is FLUX architecture.
export function modelFamily(model) {
  if (!model) return null;
  const s = [model.id, model.family, model.endpoint, model.name].filter(Boolean).join(' ');
  if (/flux/i.test(s)) return 'FLUX.1';
  if (/qwen/i.test(s)) return 'Qwen-Image';
  if (/krea/i.test(s)) return 'Krea';
  if (/wan[-\s_]?2\.1/i.test(s)) return 'Wan 2.1';
  if (/wan[-\s_]?2\.2/i.test(s)) return 'Wan 2.2';
  if (/wan/i.test(s)) return 'Wan (other)';
  return null;
}

export function modelIsVideo(model) {
  if (!model) return false;
  return /video/i.test([model.group_of, model.group, model.category].filter(Boolean).join(' '));
}

export function filterLoras(list, model, modelId) {
  const src = Array.isArray(list) ? list : [];
  if (!model && !modelId) {
    return {
      shown: src.map((lora) => ({ lora, tier: 'likely' })),
      hidden: 0, hiddenItems: [], family: null, exact: 0,
    };
  }
  const shown = [];
  const hiddenItems = [];
  let exact = 0;
  for (const lora of src) {
    const tier = compatibility(lora, model, modelId);
    if (tier === 'verified') exact += 1;
    (tier === 'no' ? hiddenItems : shown).push({ lora, tier });
  }
  // Verified first, then likely — stable within tiers.
  shown.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'verified' ? -1 : 1));
  return {
    shown, hidden: hiddenItems.length, hiddenItems,
    family: modelFamily(model), exact,
  };
}

// Tier for one LoRA against the selected model.
export function compatibility(lora, model, modelId) {
  if (!lora) return 'no';
  const lid = String(lora.id || '');
  if (modelId && (VERIFIED_LORA_RUNS || []).some((v) => v.lora === lid && v.model === modelId)) {
    return 'verified';
  }
  // Curated exact target always trusted (ranked likely until a run verifies it).
  // All provider keys are checked — id schemes never collide across providers.
  if (modelId && ['muapi_model', 'replicate_model', 'wavespeed_model'].some((k) => lora[k] && lora[k] === modelId)) return 'likely';
  const fam = modelFamily(model);
  if (fam && !familyOk(lora, fam, modelString(model))) return 'no';
  if ((lora.pipeline === 'video-generation') !== modelIsVideo(model)) return 'no';
  if (versionGap(lora.base_model, modelString(model)) === 'major') return 'no';
  return 'likely';
}

// Same family, or Wan cross-minor drift (2.1 LoRA on 2.2 and vice versa).
// Major gaps (2.x vs 3.x) stay incompatible.
function familyOk(lora, fam, modelStr) {
  const lf = loraFamily(lora);
  if (lf === fam) return true;
  if (/^Wan /.test(lf) && /^Wan /.test(fam || '')) {
    return versionGap(lora.base_model, modelStr) !== 'major';
  }
  return false;
}

function modelString(model) {
  if (!model) return '';
  return [model.id, model.family, model.endpoint, model.name].filter(Boolean).join(' ');
}

// Parse "wan 2.1" / "qwen-image-2512" style versions: { base, major, minor }.
function parseVer(s) {
  let m = /wan[-\s_]?(\d+)(?:\.(\d+))?/i.exec(s || '');
  if (m) return { base: 'wan', major: +m[1], minor: m[2] == null ? null : +m[2] };
  m = /qwen[-\s_]?image(?:[-\s_]?[a-z]+)?[-\s_]?(\d+)(?:\.(\d+))?/i.exec(s || '');
  if (m) return { base: 'qwen-image', major: +m[1], minor: m[2] == null ? null : +m[2] };
  return null;
}

// 'same' | 'minor' | 'major' | 'unknown'. Small-integer majors (wan 2 vs 3)
// are a real arch break; large date-like versions (2511 vs 2512) are drift.
export function versionGap(loraBase, modelStr) {
  const a = parseVer(loraBase);
  const b = parseVer(modelStr);
  if (!a || !b || a.base !== b.base) return 'unknown';
  if (a.major !== b.major) return (a.major < 100 && b.major < 100) ? 'major' : 'minor';
  if ((a.minor ?? 0) !== (b.minor ?? 0)) return 'minor';
  return 'same';
}
