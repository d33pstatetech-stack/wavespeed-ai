# WaveSpeed Prompt Generator

A schema-driven prompt console for the [WaveSpeed AI](https://wavespeed.ai) catalog — image, video, and audio behind one API key. It is the WaveSpeed sibling of [muapi-prompt-generator](https://github.com/d33pstatetech-stack/muapi-prompt-generator) and shares most of the front end: the same prompt enhancer, LoRA library, run history, and R2 output capture.

**Catalog:** 1,035 models across 16 categories and 540 model families, synced from `GET /api/v3/models`, with each model's parameters normalized into a JSON schema so the form can render itself.

> **Scope note:** the *hosting layer* is free on Cloudflare's Free plan. WaveSpeed *inference* is billed per model and is not free.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Why Cloudflare Workers, and what free hosting provides](#why-cloudflare-workers-and-what-free-hosting-provides)
- [Free tier budget](#free-tier-budget)
- [Where the free tier gets tight](#where-the-free-tier-gets-tight)
- [Data stores](#data-stores)
- [API reference](#api-reference)
- [Secrets and configuration](#secrets-and-configuration)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Prompt enhancer](#prompt-enhancer)
- [LoRA library and compatibility filtering](#lora-library-and-compatibility-filtering)
- [Output capture](#output-capture)
- [Jev verifier pilot](#jev-verifier-pilot)
- [Content scope](#content-scope)
- [License](#license)

---

## Features

**Catalog and parameters**
- 1,035 models synced from the WaveSpeed API, with per-model schemas normalized to `{type, options, required, default, enum}`
- Filter by category, family, or free-text search across 540 families
- One-click re-sync when WaveSpeed ships new models
- Type-aware controls: enum → select, bounded number → clamped input, boolean → toggle, `format: uri` → upload or URL

**Generation**
- Submit-then-poll — `POST /api/generate` creates a WaveSpeed task, `GET /api/predictions/:id` polls until `completed`
- Reference media for `image_url`, `images_list`, and last-frame parameters
- Multi-output gallery: every returned URL is surfaced, with a tab strip on the result card
- Cost estimate before committing to a run
- Local run history plus a shared D1-backed run log, with per-run star rating

**AI prompt enhancer**
- Model-aware prompt rewriting with a provider fallback chain
- Server-sent-event streaming, plus a buffered JSON mode
- Per-family formatting presets: Wan, Seedance, MiniMax/Hailuo, Kling/Luma
- Per-prompt persistence of raw text, enhanced text, model, params, and the LLM that produced it

**LoRA support**
- Browse Hugging Face and CivitAI, or resolve either from a pasted model-card URL
- Curated seed list of public community adapters, plus a separate bucket of uncensored adapters (see [Content scope](#content-scope))
- Custom LoRA library persisted in D1, deduplicated by source + repo + file
- Three-tier compatibility filtering against the selected model, with a major-version-gap rule for Wan

**Interface**
- React 19 + Vite 8 + Tailwind 4, built to static assets and served from the edge
- Responsive down to mobile widths
- Prompt template library and settings modal for the enhancer's LLM chain, with keys redacted over the wire
- Cloud picker for reusing previously captured R2 outputs as inputs

---

## Architecture

```
client/           → React 19 + Vite + Tailwind 4 single-page app
  src/components/ → ModelPicker, ParamForm, Enhancer, LoraPicker, CloudPicker,
                    OutputCard, HistoryGrid, LibraryModal, SettingsModal, …
  src/hooks/      → useGeneration (submit + poll), useLlmConfig
  dist/           → build output, served as Worker static assets (git-ignored)
src/worker.js     → the Worker: every /api/* route, auth gate, proxying
migrations/       → 0001 catalog, model_params, prompts, llm_config
scripts/          → sync-legacy-loras.mjs
public/           → legacy vanilla-JS front end for the static Docker preview
                    (see Dockerfile); superseded by client/ for the deployed app
```

The Worker only ever handles `/api/*`; static assets are served by Cloudflare's
asset pipeline via the `[assets]` binding.

| Binding | Resource | Purpose |
|---|---|---|
| `DB` | D1 `wavespeed-models` | Model catalog, parameter schemas, prompt templates, enhancer prompts, LLM config |
| `HISTORY` | D1 `genai-history` | Run log, enhancements, custom LoRA library, judge verdicts |
| `OUTPUTS_BUCKET` | R2 `genai-assets` | Captured generation outputs |

`HISTORY` and the R2 bucket are the same resources the sibling apps use, which
is what lets one run be inspected from any of them.

---

## Why Cloudflare Workers, and what free hosting provides

This application is a good fit for the Workers Free plan for a structural
reason: **almost all of its work is waiting on someone else's network.** The
Worker receives a request, forwards it to WaveSpeed or to an LLM provider, and
streams the response back. Cloudflare does not count time spent waiting on a
`fetch()` toward CPU time, so the 10 ms CPU ceiling that constrains
compute-bound Workers barely registers here.

What that provides in practice:

**Zero infrastructure cost to run.** No server to rent, no container to size, no
idle instance burning money between uses. A side tool or demo that nobody opens
for a month costs nothing to keep online.

**A global HTTPS endpoint with no origin to maintain.** Every deployment gets a
`*.workers.dev` hostname, or a custom domain with automatic certificates and edge
caching. There is nothing to patch, secure, or reboot.

**Deploys are atomic rollouts.** Publishing shifts traffic when the new version is
ready and keeps the previous one available for rollback. There is no session
state in the Worker to drain, because all state lives in D1 and R2.

**The API key never reaches the browser.** `WAVESPEED_API_KEY` is stored as an
encrypted Worker secret and injected per request. The browser talks to
`/api/*` and never holds the key, which is also why the same front end can be
served as a static image with a bring-your-own-key fallback.

**Authentication happens at the edge.** Cloudflare Access rejects
unauthenticated requests before they reach Worker code, so an unauthenticated
attempt costs nothing and never touches the key. The Worker keeps a redundant
`Cf-Access-Jwt-Assertion` check as defense in depth and returns a JSON `401` for
API clients instead of an HTML login page.

**Free R2 egress, which is the decisive one here.** Generated images, video, and
audio are the bulk of the traffic. Storing them in R2 and serving them back costs
nothing in bandwidth, which is what makes "keep every output in history" a
reasonable default rather than a bill.

**Static assets come from the edge cache.** The built front end ships as static
assets, so page loads do not consume Worker invocations the way dynamic routes do.

---

## Free tier budget

Figures are the Workers Free plan limits this resource mix is measured against.
Daily limits reset at 00:00 UTC; monthly ones at the subscription renewal date.

| Resource | Free allowance | Relevance here |
|---|---|---|
| Worker requests | 100,000 / day | Page loads and every API call. Polling dominates. |
| Worker CPU | 10 ms / request | Rarely binding — the Worker is I/O bound and network wait is not counted. |
| Worker memory | 128 MB | Comfortable. |
| Subrequests | 50 external / 1,000 to Cloudflare services per request | A single generate call uses a handful. |
| Worker size | 64 MiB | Not close — plain JavaScript, no dependencies. |
| Static assets | 20,000 files, 25 MiB each per version | The Vite bundle is well inside this. |
| D1 rows read | 5,000,000 / day | The 1,035-model catalog listing dominates. |
| D1 rows written | 100,000 / day | Run log, prompts, custom LoRAs. |
| D1 storage | 5 GB total | Catalog plus parameter schemas. |
| D1 egress | none | D1 is never charged for data transfer. |
| R2 storage | 10 GB-month / month | Output captures accumulate here. |
| R2 operations | 1M Class A / 10M Class B per month | Writes on capture, reads on replay. |
| R2 egress | free | The single largest practical win. |
| Access users | 50 seats | Ample for a private team tool. |

Since 1 September 2026, D1 on the Free plan *enforces* its daily row limits:
queries return an error once the limit is reached, and stored data is unaffected.
Cloudflare sends an email when a limit is hit.

---

## Where the free tier gets tight

This catalog is an order of magnitude larger than the sibling apps', and that
shows up in the numbers:

- **`GET /api/models?limit=1000` is the heaviest single request.** With 1,035
  models it returns the entire catalog, scanning on the order of a thousand rows
  and serializing a large response. It is the request most likely to press
  against both the CPU ceiling and the D1 row-read budget, and the first place
  to add a CDN `Cache-Control` header as usage grows.
- **D1 row reads are the real constraint, not CPU.** An uncached full-catalog
  listing is on the order of a thousand rows read. Against a 5M daily budget
  that allows several thousand such requests per day, so the request limit
  usually binds first — but the two are close enough in order of magnitude to
  watch together.
- **Request count still binds before CPU per call.** Polling every 2.5s for
  several minutes is dozens of requests for one generation.
- **The shared `genai-history` database is account-wide.** All the sibling apps
  write to it, so D1 limits are a shared resource rather than a per-app one.
- **R2 storage fills at 10 GB-month.** Output archives are what outgrow the free
  allowance first; a lifecycle rule that expires old objects keeps it predictable.
- **10 ms CPU leaves no headroom.** Any future feature doing image processing,
  large JSON transforms, or crypto in the Worker would need `cpu_ms` raised,
  which is a Workers Paid capability.

---

## Data stores

**`wavespeed-models` (D1)** — `models` holds identity, category, family, cost,
and the upstream endpoint; `model_params` holds the normalized JSON schema per
model; `prompts` and `llm_config` come from the enhancer; `saved_prompts` and
`catalog_meta` round out the schema. Indexes on `category`, `family`, and `name`
keep filtered queries cheap.

**`genai-history` (D1)** — operational state, created defensively on first use
so a fresh database needs no migration step: `runs`, `enhancements`,
`custom_loras` (unique on source + repo + file), and `judge_verdicts`.

**`genai-assets` (R2)** — captured outputs under a `wavespeed/YYYYMMDD/…` key
prefix, replayed through the Worker with an extension-based content-type
fallback so objects stored as `application/octet-stream` still download with a
usable MIME type.

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Model count, last sync time, key status |
| GET | `/api/models` | Catalog listing — `?category=&family=&group_of=&q=&limit=` |
| GET | `/api/models/:id` | Single model plus parameter schema |
| GET | `/api/categories` | Category counts |
| GET | `/api/families` | Family counts |
| POST | `/api/sync` | Re-fetch the catalog from WaveSpeed into D1 |
| POST | `/api/generate` | Submit a task — `{modelId, params}` |
| GET | `/api/predictions/:id` | Poll a task for status and outputs |
| POST | `/api/estimate` | Cost estimate without generating |
| POST | `/api/upload` | Upload a reference file → hosted URL |
| POST | `/api/enhance` | Stream an enhanced prompt (SSE) |
| POST | `/api/optimize` | Same, buffered to JSON |
| GET/PUT | `/api/llm-config` | Read (redacted) or write the enhancer's LLM chain |
| GET | `/api/prompts` | List persisted prompts |
| POST | `/api/lora/resolve` | Resolve a Hugging Face or CivitAI model-card URL to LoRA file(s) |
| GET/POST/DELETE | `/api/loras/custom` | Shared custom LoRA library |
| GET | `/api/cloud/list` | List the R2 output bucket |
| GET | `/api/cloud/file` | Fetch one R2 object |
| POST | `/api/cloud/resolve` | Rehost an R2 object through WaveSpeed for a fresh URL |
| POST | `/api/wavespeed/save-outputs` | Server-side fetch of output URLs into R2 |
| GET | `/api/wavespeed/file` | Stream an object back out of R2 |
| GET | `/api/history/runs` | Run log with filters |
| POST | `/api/history/link` | Attach an enhancement to a run |
| POST | `/api/history/rate` | Star-rate a run |
| POST | `/api/judge` | Proxy to the Jev verifier |
| POST | `/api/judge/log` | Record a verdict for calibration |

The gate covers every route that spends a key or can modify state. The read-only
catalog routes and `/api/health` stay open in the Worker so the model list can be
browsed and cached without a session. An Access application covering the whole
hostname will still intercept them at the edge; the split only matters if Access
is scoped to specific paths.

---

## Secrets and configuration

| Name | Required | Purpose |
|---|---|---|
| `WAVESPEED_API_KEY` | yes | Task submission, polling, upload, estimate |
| `WAVESPEED_BASE_URL` | no | Override the API base (`[vars]`, defaults to `https://api.wavespeed.ai/api/v3`) |
| `OPENROUTER_API_KEY` | for enhancer | Default LLM provider |
| `VENICE_API_KEY` | optional | Alternative LLM provider in the chain |
| `HUGGINGFACE_API_KEY` | optional | Raises Hugging Face rate limits for LoRA fetches |
| `CIVITAI_API_KEY` | optional | Authenticated CivitAI model lookups |
| `JEV_API_KEY` | for verifier | Jev `/api/judge` proxy |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | for presigned URLs | Let the client pull R2 objects directly, so the Worker never proxies the bytes |

`HF_PROXY_BASE_URL` is a plain var rather than a secret; leave it empty to
advertise the incoming request origin, and set it when preview deployments get
ephemeral hostnames that upstream fetchers cannot reach.

Secrets are set with `wrangler secret put` and injected per request. `.dev.vars`
and `.env` are git-ignored; never commit a populated copy.

---

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # add WAVESPEED_API_KEY

# Front end (hot reload on :5173, talks to the Worker on :8787)
cd client
npm install
npm run dev

# Worker + local D1 (in a second terminal)
npx wrangler d1 execute wavespeed-models --local --file=migrations/0001_init.sql
npm run sync
npx wrangler dev
```

`wrangler dev` serves on `127.0.0.1`, and the auth gate treats loopback as
authenticated, so no Access setup is needed to develop locally. Client linting
is `npm run lint` in `client/` (oxlint).

---

## Deployment

```bash
# Schema, once per environment
npx wrangler d1 execute wavespeed-models --remote --file=migrations/0001_init.sql
npm run sync

# Build the front end into client/dist
cd client && npm run build && cd ..

# Secrets
npx wrangler secret put WAVESPEED_API_KEY
npx wrangler secret put OPENROUTER_API_KEY

# Publish
npx wrangler deploy
```

The `database_id` and `R2_ACCOUNT_ID` values in `wrangler.toml` are
environment-specific; a fork needs its own from `wrangler d1 create` and
`wrangler r2 bucket`. `R2_ACCOUNT_ID` is an account identifier rather than a
credential, but it still identifies one account.

**Access must be configured before the API is usable.** The Worker requires a
valid `Cf-Access-Jwt-Assertion` or `Cf-Access-Authenticated-User-Email` header
on every protected prefix and only exempts loopback. A deployment without a
matching Access application returns `401` on the protected routes even though
the front end loads fine. Creating a self-hosted Access application over the
`*.workers.dev` hostname is the missing step in any fresh fork.

---

## Prompt enhancer

The enhancer rewrites a prompt for the specific target model, adding sound-effect
and dialogue cues when the target generates audio and timestamp directions for
video models based on the requested duration. Responses stream to the browser as
server-sent events and the full text is persisted once the stream completes.

Providers are tried in order until one succeeds:

1. `https://openrouter.ai/api/v1` — `liquid/lfm-2.5-2.6b:free`
2. `https://openrouter.ai/api/v1` — `openrouter/free`
3. `https://api.venice.ai/api/v1` — `venice-uncensored`

Venice model IDs change as their catalog rotates, so any Venice entry is worth
confirming before relying on it; a stale ID surfaces as a `404` that the chain
falls through. The chain is stored in the `llm_config` D1 row when set through
the settings modal and falls back to these defaults otherwise. Keys are resolved
per provider from the matching environment secret and are always redacted on read.

The system prompt is deliberately framed as format optimization only, so the
enhancer performs mechanical conversion for any subject matter and leaves
content policy to the downstream generative model.

---

## LoRA library and compatibility filtering

LoRAs can be browsed from Hugging Face and CivitAI, or resolved from a pasted
model-card URL through `POST /api/lora/resolve`. CivitAI lookups use
`CIVITAI_API_KEY` when present. Anything added by hand joins a shared library in
D1, deduplicated on source + repo + file.

`client/src/loras-data.js` ships a small seed list of public community adapters,
one per family the compatibility filter understands, so the picker is useful on a
fresh clone. It is a starting point, not a curated endorsement. The seed spans
FLUX.1, Qwen-Image, Krea, and Wan 2.1, which also keeps the tier dots visible on
a first run. The legacy preview's copy is regenerated from it with
`node scripts/sync-legacy-loras.mjs public/loras.js`.

Picking a LoRA the selected model cannot load wastes a generation, so the
pickers filter by compatibility using a three-tier model in
`client/src/lora-compat.js`:

- **Verified** (green) — the exact LoRA and model pair has completed a real run. The list starts empty, since a pair only earns green once it has actually run; add a row to `VERIFIED_LORA_RUNS` when one does.
- **Likely** (yellow) — curated target, matching family and pipeline, tolerating minor version drift such as Wan 2.1 against 2.2. This is where most seed entries land.
- **Incompatible** (red) — family mismatch, pipeline mismatch, or a major version gap such as Wan 2.x against 3.x. Hidden unless show-all is enabled.

That last rule matters more here than in the sibling apps: this catalog carries
both Wan 2.x and Wan 3.0, and a Wan 2.1 LoRA loaded into a Wan 3.0 model fails
silently rather than degrading, so the picker hides those outright.

---

## Output capture

WaveSpeed output URLs are short-lived. On a successful run the app posts them to
`/api/wavespeed/save-outputs` and the Worker pulls each file into the
`genai-assets` R2 bucket under `wavespeed/YYYYMMDD/…`. The cloud save can also be
wired to presigned R2 URLs, in which case the client pulls the object directly
and the Worker never proxies the bytes at all.
`/api/wavespeed/file?key=…` serves a saved object back, and `/api/cloud/*`
browses the bucket so a stored output can be reused as an input.

---

## Jev verifier pilot

`POST /api/judge` proxies to the Jev verifier with an abort-based timeout, and
`POST /api/judge/log` records the probability, model, and latency of each check so
thresholds can be calibrated against real traffic before the signal is trusted.
The tables are created on first write, so the pilot can be removed without a
migration. Without `JEV_API_KEY` the route returns a clear not-configured error
and the rest of the application is unaffected.

---

## Content scope

This is a prompt-engineering tool, and it treats prompts as an optimization
problem rather than a content-moderation one.

**The enhancer does not filter.** Its system prompt frames the task as format
conversion, so it rewrites a prompt for the target model regardless of subject
matter and leaves policy to the downstream model.

**The LoRA picker has a second bucket.** Alongside the general seed list,
`NSFW_LORAS` in `client/src/loras-data.js` holds uncensored and adult-oriented
adapters under a separate picker variant so the default view stays clean. These
are ordinary public community checkpoints; the only thing distinguishing them is
which list they appear in. They are handled identically to any other adapter —
same schema, same compatibility tiers, same add-from-URL path.

Whether a given output is permitted is still up to WaveSpeed and the individual
model. Use of any adapter is subject to the licence of the individual checkpoint
and to the terms of the service actually generating the output.

---

## License

MIT
