# WaveSpeed Prompt Generator

Generate images/video/audio with **WaveSpeedAI** (1000+ models, one API key) —
schema-driven prompt UI, like `muapi-prompt-generator` but for
`api.wavespeed.ai/api/v3`.

- **Catalog**: `GET /api/v3/models` synced into D1 (id, per-model JSON-schema
  params normalized to `{type, options, required, default, …}`).
- **Generate**: `POST /api/generate` → WaveSpeed task → poll
  `GET /api/predictions/:id` until `completed`.
- **History**: every run + enhancement logged to shared `genai-history` D1;
  outputs auto-saved to R2 `genai-assets` (`wavespeed/YYYYMMDD/…`).
- **Enhancer**: Venice → OpenRouter chain, per-family presets (wan, seedance,
  minimax/hailuo, kling/luma).

## Setup

```bash
npm install -g wrangler   # or npx wrangler
cp .dev.vars.example .dev.vars   # if present, else create with WAVESPEED_API_KEY=...
wrangler d1 migrations apply wavespeed-models --local
npm run sync              # or: POST /api/sync (populates catalog from WaveSpeed)
wrangler dev              # local full stack (localhost bypasses Access gate)
wrangler deploy           # production
```

Secrets (`WAVESPEED_API_KEY`, `VENICE_API_KEY`, `OPENROUTER_API_KEY`) go via
`wrangler secret put` — never in code. `.dev.vars` is gitignored.
