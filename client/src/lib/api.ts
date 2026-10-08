/**
 * Real data layer for the redesigned WaveSpeed console.
 *
 * Every function talks to the Worker. Nothing is simulated and there is no
 * in-memory catalogue fallback: if the Worker is unreachable the UI reports it
 * rather than inventing models.
 */
import {
  fetchModels as fetchRows,
  fetchModelStats,
  estimateCost as postEstimate,
  streamEnhance as postEnhance,
  submitGenerate,
  pollPrediction,
  resolveLoraUrl as apiResolveLoraUrl,
  fetchCustomLoras as apiCustomLoras,
  saveCustomLora as apiSaveCustomLora,
  deleteCustomLora as apiDeleteCustomLora,
  fetchLibrary as apiLibrary,
  fetchVerifications as apiVerifications,
} from '../api';
import { applySchema, toModel, modelModality } from './models';
import type { Lora, Model, ModelSchema } from './types';

type Stats = Map<string, { runs: number; rating: number | null }>;

const errText = (v: any, fallback = ''): string => {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => errText(x, '')).filter(Boolean).join('; ') || fallback;
  if (typeof v === 'object') return errText(v.message ?? v.error ?? v.detail ?? v.msg, fallback);
  return String(v);
};

/**
 * Real catalogue from D1, enriched with real run counts and average ratings.
 * Stats are best-effort: if that read fails the catalogue still loads and the UI
 * says why the counts are missing.
 */
export async function fetchModels(): Promise<{ models: Model[]; statsFailed: boolean }> {
  const rows = await fetchRows();
  let stats: Stats | undefined;
  let statsFailed = false;
  try {
    const raw: any = await fetchModelStats({ limit: 200 });
    // The Worker returns { models, total } here.
    const list: any[] = Array.isArray(raw) ? raw : raw?.models || raw?.stats || [];
    stats = new Map(
      list.filter((r) => r && r.model).map((r) => [r.model, { runs: Number(r.runs) || 0, rating: r.avg_rating == null ? null : Number(r.avg_rating) }]),
    );
  } catch {
    statsFailed = true;
  }
  return { models: rows.map((r: any) => toModel(r, stats)), statsFailed };
}

export async function fetchSchema(id: string): Promise<ModelSchema> {
  const res = await fetch(`/api/models/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(data.error || data.message, `Schema failed (${res.status})`));
  const ps = data?.paramSchema;
  return { params: ps?.params || {}, defaults: ps?.defaults || {} };
}

export function withSchema(model: Model | null, schema: ModelSchema | null): Model | null {
  return model && schema ? applySchema(model, schema) : model;
}

/** Real estimate from the Worker. Falls back to the model's base cost. */
export async function estimateCost(model: Model | null, params: Record<string, unknown>): Promise<number> {
  if (!model) return 0;
  try {
    const d: any = await postEstimate({ modelId: model.id, params });
    const v = Number(d?.estimatedCost ?? d?.cost ?? d?.estimate ?? d?.total);
    if (Number.isFinite(v) && v >= 0) return v;
  } catch {
    /* fall through to base cost */
  }
  return model.cost || 0;
}

/**
 * Real streaming enhancement through the Worker's SSE route, which walks the
 * configured provider chain. The selected model's own group is sent as
 * `modality` so the Worker picks the image or video template from the client's
 * reading rather than only its own derivation.
 */
export async function streamEnhance(
  rawPrompt: string,
  model: Model | null,
  onToken: (text: string) => void,
  signal?: AbortSignal,
  params: Record<string, unknown> = {},
): Promise<{ text: string; providerUsed: string; modelUsed: string; historyId: number | null }> {
  return postEnhance({ rawPrompt, modelId: model?.id || '', params, modality: modelModality(model), signal, onToken, onMeta: () => {} } as any);
}

export interface SubmitResult {
  requestId: string;
  outputs: string[];
  cost: number;
  elapsedMs: number;
}

const POLL_MS = 2500;
const MAX_POLL_MS = 15 * 60 * 1000;

/**
 * Real generation: POST /api/generate then poll until a terminal state.
 * `onProgress` carries the server's own status text, so the bar reflects the
 * Worker rather than a local timer.
 */
export async function runGeneration(
  model: Model,
  params: Record<string, unknown>,
  onProgress: (p: number, phase: string) => void,
  signal: AbortSignal,
): Promise<SubmitResult> {
  const started = Date.now();
  const submitted: any = await submitGenerate({ modelId: model.id, params, enhancementId: null });
  const requestId = submitted.requestId;

  for (;;) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (Date.now() - started > MAX_POLL_MS) {
      throw new Error(`No result after 15m. The job may still be queued server-side. ID: ${requestId}`);
    }
    const d: any = await pollPrediction(requestId);
    const st = d?.status || d?.detail?.status;
    const elapsed = (Date.now() - started) / 1000;

    if (st === 'completed' || st === 'succeeded') {
      onProgress(1, 'Complete');
      return {
        requestId,
        outputs: d.outputs || d.output_urls || d.output || [],
        cost: Number(submitted.cost) || 0,
        elapsedMs: Date.now() - started,
      };
    }
    if (st === 'failed' || st === 'error' || st === 'canceled' || st === 'cancelled') {
      const msg = d?.error || d?.detail?.error || d?.message || d?.detail?.message || 'Generation failed';
      throw new Error(`${errText(msg, 'Generation failed')} [id: ${requestId}]`);
    }
    onProgress(st === 'processing' ? 0.6 : st === 'queued' || st === 'starting' ? 0.2 : 0.4, `${st || 'working'} · ${elapsed.toFixed(0)}s`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/* ---------------- LoRAs ---------------- */

export const resolveLoraUrl = apiResolveLoraUrl;
export const saveCustomLora = apiSaveCustomLora;
export const deleteCustomLora = apiDeleteCustomLora;

export async function fetchCustomLoras(): Promise<any[]> {
  try {
    return await apiCustomLoras();
  } catch {
    return [];
  }
}

/* Central LoRA repository (Phase A read-only). Fail-soft to null so callers
   can tell "unreachable/old worker" apart from "reachable but empty" ([]) —
   only a non-empty array replaces the baked seed. */
export async function fetchLibrary(): Promise<any[] | null> {
  try {
    return await apiLibrary();
  } catch {
    return null;
  }
}

/* Run-confirmed LoRA ↔ model pairs. Fail-soft to null; only a non-empty
   array overrides the baked CONFIRMED/VERIFIED lists. */
export async function fetchVerifications(): Promise<any[] | null> {
  try {
    return await apiVerifications();
  } catch {
    return null;
  }
}

/**
 * Maps a real loras-data.js entry onto the UI's Lora shape.
 *
 * `baseFamily` is filled from the real lora-compat loraFamily(), which is what
 * the tier calculation compares against, rather than the mockup's invented
 * mapping.
 */
export function toLora(entry: any, custom = false): Lora {
  const id = String(entry?.id || entry?.repo || '');
  const src = String(entry?.repo_url || entry?.id || '');
  return {
    id,
    name: entry?.name || id,
    source: custom ? 'custom' : /civitai/i.test(src) ? 'civitai' : 'huggingface',
    repo: repoOf(entry),
    baseFamily: entry?.baseFamily || '',
    triggers: Array.isArray(entry?.triggers) ? entry.triggers : [],
    custom,
    entry,
  };
}

export function repoOf(entry: any): string {
  const u = String(entry?.repo_url || '');
  if (u) return u.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return String(entry?.id || '');
}