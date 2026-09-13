-- Model catalog from WaveSpeed live API (GET /api/v3/models)
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,              -- model id, e.g. "wavespeed-ai/z-image/turbo"
  name TEXT NOT NULL,               -- display name
  description TEXT,
  category TEXT NOT NULL,           -- "Text to Image", "Image to Video", etc.
  family TEXT,                      -- "wan-3.0", "minimax-h3", "kling-v3.0", etc.
  group_of TEXT,                    -- "image", "video", "audio", "3d", "text", "other"
  cost REAL,                        -- USD base price per call
  cost_currency TEXT DEFAULT 'USD',
  dynamic_pricing INTEGER DEFAULT 1,-- 1: final charge scales with params
  endpoint TEXT NOT NULL,           -- "/api/v3/wavespeed-ai/z-image/turbo"
  playground_url TEXT,              -- "https://wavespeed.ai/..." (when known)
  llms_txt_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_models_category ON models(category);
CREATE INDEX IF NOT EXISTS idx_models_family ON models(family);
CREATE INDEX IF NOT EXISTS idx_models_group_of ON models(group_of);
CREATE INDEX IF NOT EXISTS idx_models_name ON models(name);

-- Model-specific parameter schemas (JSON, normalized to MuAPI shape:
-- {prop: {type, options, required, default, title, description, ...}})
CREATE TABLE IF NOT EXISTS model_params (
  model_id TEXT PRIMARY KEY REFERENCES models(id),
  schema_json TEXT NOT NULL,        -- normalized param specs
  defaults_json TEXT,               -- default values
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- User saved prompts (client-side for now, but schema ready)
CREATE TABLE IF NOT EXISTS saved_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  params_json TEXT,
  tags TEXT,                        -- comma-separated
  created_at TEXT DEFAULT (datetime('now'))
);

-- Cached catalog metadata
CREATE TABLE IF NOT EXISTS catalog_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Prompt enhancer persistence (legacy per-app table; shared genai-history is primary)
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'enhanced',
  prompt TEXT NOT NULL,
  enhanced TEXT,
  model_id TEXT,
  params_json TEXT,
  llm_provider TEXT,
  llm_model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prompts_kind ON prompts(kind);
CREATE INDEX IF NOT EXISTS idx_prompts_model ON prompts(model_id);
CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts(created_at DESC);

CREATE TABLE IF NOT EXISTS llm_config (
  id INTEGER PRIMARY KEY CHECK(id=1),
  json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
