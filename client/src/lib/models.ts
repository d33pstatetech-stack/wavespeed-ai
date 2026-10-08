/**
 * Real catalogue mapper for the WaveSpeed app.
 *
 * Turns the D1 `models` rows served by the Worker into the shape the UI wants.
 * Every field has a real source; anything the mockup invented is absent.
 */
import { modelFamily, modelIsVideo } from '../lora-compat';
import type { Model, ModelSchema, ParamSpec } from './types';

/* WaveSpeed's `group_of` uses MuAPI's vocabulary ("video-edit", "image-tools",
   "music", "avatar"…), finer than the five media types the filter offers.
   Keyword match beats dropping rows into "other". */
const GROUP_RULES: [RegExp, Model['group']][] = [
  [/3d|three[-_ ]?d|mesh|voxel/i, '3d'],
  [/video|animate|motion|t2v|i2v|v2v|avatar|lip[-_ ]?sync|talking|face[-_ ]?dance/i, 'video'],
  [/audio|speech|voice|sound|music|song|tts|stt|sing|sfx|transcri/i, 'audio'],
  [/image|picture|photo|draw|paint|illustrat|upscal|restor|enhanc|background|remove|edit|face|inpaint|logo|icon|render|thumbnail|text[-_ ]?to[-_ ]?image/i, 'image'],
  [/text|llm|chat|prompt|seo|translat|summar|classif|extract|ocr|spell|grammar|rewrit/i, 'text'],
  [/publish|instagram|tiktok|pinterest|linkedin|threads|youtube|facebook|twitter|social/i, 'text'],
];

export function normalizeGroup(row: Row): Model['group'] {
  const hay = [row.group_of, row.category, row.family, row.id, row.name].filter(Boolean).join(' ');
  for (const [re, g] of GROUP_RULES) if (re.test(hay)) return g;
  return modelIsVideo(row) ? 'video' : 'image';
}

export type Stats = Map<string, { runs: number; rating: number | null }>;

/**
 * The `body.modality` the enhance request sends, or null when this model is
 * neither image nor video (audio/3d/text/"Other" — the Worker has no
 * image/video template to override, so it should derive the media type itself).
 */
export function modelModality(m: Model | null): 'image' | 'video' | null {
  if (!m) return null;
  if (m.group === 'video') return 'video';
  if (m.group === 'image') return 'image';
  return null;
}

export function toModel(row: Row, stats?: Stats): Model {
  const s = stats?.get(row.id);
  return {
    id: row.id,
    name: row.name || row.id,
    family: row.family || '',
    category: row.category || '',
    group: normalizeGroup(row),
    cost: Number(row.cost) || 0,
    dynamicPricing: !!Number(row.dynamic_pricing),
    runs: s?.runs ?? 0,
    rating: s?.rating ?? null,
    summary: row.description || '',
    loraCapable: false,
    durationHint: undefined,
    baseFamily: modelFamily(row) || '',
    _row: row,
  };
}

/**
 * Fills the two schema-derived fields once the real param schema arrives.
 *
 * `loraCapable` — true when the schema declares an adapter parameter (85 of the
 *                1081 WaveSpeed models do).
 * `durationHint` — derived from the schema's own `duration` parameter, which 416
 *                models declare. Rendered from real min/max/default, e.g. a
 *                range of 4-30 with a default of 5 becomes "5s (4-30s)". Models
 *                without that parameter get no hint rather than a guess.
 */
export function applySchema(model: Model, schema: ModelSchema | null): Model {
  if (!schema) return model;
  const hasLora = Object.entries(schema.params).some(([name, spec]) => isLoraParam(name, spec));
  const durationHint = durationOf(schema.params);
  return { ...model, loraCapable: hasLora, durationHint };
}

function durationOf(params: Record<string, ParamSpec>): string | undefined {
  const spec = params?.duration;
  if (!spec || spec.type !== 'number' && spec.type !== 'integer') return undefined;
  const def = Number((spec as any).default);
  const lo = Number((spec as any).min ?? (spec as any).minimum);
  const hi = Number((spec as any).max ?? (spec as any).maximum);
  if (Number.isFinite(def)) {
    const range = Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi ? ` (${lo}-${hi}s)` : '';
    return `${def}s${range}`;
  }
  if (Number.isFinite(lo) && Number.isFinite(hi)) return `${lo}-${hi}s`;
  return undefined;
}

function isLoraParam(name: string, spec: ParamSpec = {} as ParamSpec): boolean {
  const n = String(name || '').toLowerCase();
  if (n === 'extra_lora' || n === 'extra_lora_weights' || /(^|_)replicate_weights$/.test(n)) return true;
  if (/scale|strength|weight|multiplier/.test(n)) return false;
  if (/lora|loras|adapter/.test(n)) return true;
  if (spec.type === 'array' && /\$ref/i.test(JSON.stringify(spec.items ?? {}))) return true;
  return false;
}

export interface Row {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  family: string | null;
  group_of: string | null;
  cost: number | null;
  dynamic_pricing: number | null;
  endpoint: string | null;
  is_active: number | null;
}