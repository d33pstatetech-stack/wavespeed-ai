export type Group = 'image' | 'video' | 'audio' | 'text' | '3d';

/** Compatibility tier. Mirrors lora-compat.js, where "no" is called `no`. */
export type Tier = 'verified' | 'likely' | 'unsupported';

export interface ParamSpec {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  /** MuAPI schemas label params with `title`, not `label`. */
  title?: string;
  label?: string;
  description?: string;
  required?: boolean;
  options?: (string | number)[];
  enum?: (string | number)[];
  min?: number;
  max?: number;
  step?: number;
  default?: unknown;
  format?: string;
  items?: { type?: string; $ref?: string; format?: string };
  /** Present on 1 of 724 real schemas; kept because the data is real. */
  advanced?: boolean;
}

/** Real shape from GET /api/models/:id -> paramSchema. */
export interface ModelSchema {
  params: Record<string, ParamSpec>;
  defaults: Record<string, unknown>;
}

export interface Model {
  id: string;
  name: string;
  family: string;
  category: string;
  group: Group;
  cost: number;
  dynamicPricing: boolean;
  /** REAL run count from GET /api/history/model-stats. */
  runs: number;
  /** REAL average rating from the same endpoint; null when unrated. */
  rating: number | null;
  /** REAL blurb from models.description. */
  summary: string;
  /** REAL: whether the model's own schema declares an adapter parameter. */
  loraCapable: boolean;
  /**
   * REAL, derived from the schema's own `duration` parameter
   * (416 of 1081 WaveSpeed models declare one). Absent otherwise — no guess.
   */
  durationHint?: string;
  /** REAL family key from lora-compat modelFamily(). */
  baseFamily: string;
  /** Underlying D1 row, kept for payload building. */
  _row?: unknown;
}

export interface Lora {
  id: string;
  name: string;
  source: 'huggingface' | 'civitai' | 'custom';
  repo: string;
  baseFamily: string;
  triggers: string[];
  custom?: boolean;
  /** Tier against the currently selected model; set by App. */
  compatTier?: Tier;
  /** Real entry from loras-data.js, carried through for submit + compat. */
  entry?: any;
}

export interface Run {
  id: string;
  modelId: string;
  prompt: string;
  outputs: string[];
  kind: 'image' | 'video';
  cost: number;
  elapsedMs: number;
  at: number;
  rating?: number;
}

export type JobStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface Job {
  id: string;
  modelId: string;
  prompt: string;
  status: JobStatus;
  progress: number;
  startedAt: number;
  elapsedMs: number;
  outputs: string[];
  kind: 'image' | 'video';
  cost: number;
  error?: string;
}