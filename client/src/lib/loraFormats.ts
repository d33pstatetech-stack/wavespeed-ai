/**
 * LoRA insert formats, derived from live generation tests rather than guesses.
 *
 * Each app's provider fetches adapter weights differently, so the same LoRA
 * has to be written a different way. These were established by sending real
 * paid predictions and reading what came back, not from documentation.
 *
 *   MuAPI    qwen-image-text-to-image-2512-lora, 11 cases, 6 passed
 *            owner/repo (public HF) ................ WORKS
 *            https://REPO/resolve/main/FILE ........ WORKS
 *            CivitAI resolved download URL ......... WORKS
 *            huggingface.co/... without https:// ... FAILS
 *            civitai:MODEL@VERSION ................. FAILS
 *            civitai.com/models/{id} page .......... FAILS (a page is not a file)
 *
 *   WaveSpeed wavespeed-ai/krea-v2/turbo-lora, 6 cases, 4 passed
 *            {path, scale} + repo or URL ........... WORKS
 *            a bare string ......................... FAILS "loras.0 must be an object"
 *            {url: ...} ............................ FAILS, the key must be "path"
 *            The form takes text and buildSubmitParams builds the object, so the
 *            text to insert is the same as MuAPI's.
 *
 *   Replicate d33pstatetech-stack/aznten_replicate, 4 cases
 *            https://...safetensors ................ WORKS
 *            no LoRA ............................... WORKS (control)
 *            owner/repo ............................ FAILS, Replicate fetches the
 *                                                   tarball from replicate.com
 *                                                   and the download fails
 */

export type App = 'muapi' | 'wavespeed' | 'replicate';

/** Shapes a provider accepts, in the order we prefer to try them. */
export type LoRaFormat = 'repo' | 'resolve-url' | 'file-url';

export interface FormatResult {
  format: LoRaFormat;
  value: string;
  note: string;
}

/**
 * Builds the value to insert into a LoRA field for a given app.
 *
 * `fileUrl` is the fully-qualified weight URL the resolver returned. `repo` is
 * the bare owner/repo (HF) or the CivitAI download URL.
 *
 * Returns null only when there is nothing usable to insert.
 */
export function insertFormat(app: App, entry: any): FormatResult | null {
  const repo = repoOf(entry);
  const fileUrl = String(entry?.file_url || entry?.resolved_url || '').trim();
  const isCivitai = /civitai/i.test(repo) || /civitai/i.test(String(entry?.repo_url || ''));
  const isHfRepo = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo);

  // Replicate only fetches a real file. A bare repo name is interpreted as a
  // Replicate model and the tarball download fails, so it is never offered.
  if (app === 'replicate') {
    if (fileUrl) {
      return { format: 'file-url', value: fileUrl, note: 'Replicate needs a direct file URL. Verified working.' };
    }
    if (isCivitai) {
      return {
        format: 'file-url',
        value: repo,
        note: 'Replicate needs the CivitAI download URL, not the model page. Add it via "Add from URL" so it can be resolved first.',
      };
    }
    if (isHfRepo) {
      return {
        format: 'file-url',
        value: `https://huggingface.co/${repo}/resolve/main/UNKNOWN.safetensors`,
        note: 'Replicate needs a full file URL. Replace UNKNOWN.safetensors with the real filename from the repo page.',
      };
    }
    return null;
  }

  // MuAPI and WaveSpeed both accept a bare owner/repo for public HF adapters,
  // which is the shortest thing that works.
  if (isHfRepo) {
    return { format: 'repo', value: repo, note: 'Verified working on ' + appName(app) + ' for public HuggingFace repos.' };
  }
  if (fileUrl) {
    return { format: 'file-url', value: fileUrl, note: 'Verified working on ' + appName(app) + ' as a direct file URL.' };
  }
  if (repo) {
    return { format: 'file-url', value: repo, note: 'A model page is not a weight file. Resolve it first so a download URL is available.' };
  }
  return null;
}

function repoOf(entry: any): string {
  const u = String(entry?.repo_url || entry?.file_url || '');
  if (u) {
    // Keep a CivitAI download URL intact; it carries the query string.
    if (/civitai/i.test(u) && /\/api\/download\//i.test(u)) return u;
    return u.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
  return String(entry?.id || '').replace(/^civitai:/, '');
}

function appName(app: App) {
  return app === 'muapi' ? 'MuAPI' : app === 'wavespeed' ? 'WaveSpeed' : 'Replicate';
}

/* ------------------------------------------------------------------
   Pairs confirmed by a real completed generation. Keyed model -> LoRA
   identifiers. The catalogue badge and the compatibility tier both read
   this, so a green tick always means "this exact pair produced an image",
   never "these two probably go together".
   ------------------------------------------------------------------ */
export const CONFIRMED_LORA_RUNS: { model: string; loras: string[]; apps: App[] }[] = [
  {
    model: 'qwen-image-text-to-image-2512-lora',
    apps: ['muapi'],
    loras: [
      'Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style',
      'gokaygokay/Krea-2-Realism-LoRA',
      'D33pStateTech/d33pstateten',
      'D33pStateTech/d33pstateLora',
      'Wuli-art/Qwen-Image-2512-Turbo-LoRA',
      'civitai:2877049',
    ],
  },
  {
    model: 'krea-v2-turbo-lora',
    apps: ['muapi'],
    loras: ['civitai:2877049', 'lvladikov/Krea2-Turbo-Distill-4step-LoRA'],
  },
  {
    model: 'wavespeed-ai/krea-v2/turbo-lora',
    apps: ['wavespeed'],
    loras: [
      'Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style',
      'gokaygokay/Krea-2-Realism-LoRA',
      'D33pStateTech/d33pstateten',
      'D33pStateTech/d33pstateLora',
      'lvladikov/Krea2-Turbo-Distill-4step-LoRA',
    ],
  },
  {
    model: 'd33pstatetech-stack/aznten_replicate',
    apps: ['replicate'],
    loras: [
      'Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style',
      'https://huggingface.co/Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style/resolve/main/Flux_1_Dev_LoRA_Paper-Cutout-Style.safetensors',
      'D33pStateTech/aznten-flux-schnell-mimicpc',
      'https://huggingface.co/D33pStateTech/aznten-flux-schnell-mimicpc/resolve/main/aznten-flux-schnell-mimicpc.safetensors',
    ],
  },
  {
    model: 'qwen/qwen-image',
    apps: ['replicate'],
    loras: [
      'Wuli-art/Qwen-Image-2512-Turbo-LoRA',
      'https://huggingface.co/Wuli-art/Qwen-Image-2512-Turbo-LoRA/resolve/main/Wuli-Qwen-Image-2512-Turbo-LoRA-4steps-V3.0-bf16.safetensors',
    ],
  },
  {
    model: 'wan-video/wan2.1-with-lora',
    apps: ['replicate'],
    loras: [
      'jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora',
    ],
  },
  {
    model: 'wavespeed-ai/qwen-image/text-to-image-2512-lora',
    apps: ['wavespeed'],
    loras: [
      'Wuli-art/Qwen-Image-2512-Turbo-LoRA',
    ],
  },
  {
    model: 'wavespeed-ai/flux-schnell-lora',
    apps: ['wavespeed'],
    loras: [
      'D33pStateTech/aznten-flux-schnell-mimicpc',
    ],
  },
];

/** True when this exact model + LoRA pair has produced a real image. */
export function isConfirmed(app: App, modelId: string | null | undefined, loraId: string): boolean {
  if (!modelId) return false;
  for (const row of CONFIRMED_LORA_RUNS) {
    if (row.model !== modelId) continue;
    if (!row.apps.includes(app)) continue;
    if (row.loras.includes(loraId)) return true;
    // CivitAI entries are stored under either the id or the resolved URL.
    if (/^civitai:/.test(loraId)) {
      const n = loraId.replace(/^civitai:/, '');
      if (row.loras.some((x) => x.includes(n))) return true;
    }
  }
  return false;
}