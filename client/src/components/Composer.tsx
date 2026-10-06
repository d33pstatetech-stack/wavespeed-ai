import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, ModelName, Spinner, Tip } from "../ui/primitives";
import { useToast } from "../ui/Toasts";
import ParamForm from "./ParamForm";
import { estimateCost, streamEnhance } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { TEMPLATES } from "../enhancer";
import type { Job, Lora, Model, ModelSchema } from "../lib/types";

export default function Composer({
  model,
  schema,
  loadingSchema,
  prompt,
  setPrompt,
  params,
  setParams,
  pinnedLoras,
  onOpenLoras,
  onGenerate,
  onCancel,
  onEnhanced,
  job,
  onBrowseModels,
  adhocLora,
  setAdhocLora,
}: {
  model: Model | null;
  schema: ModelSchema | null;
  loadingSchema: boolean;
  prompt: string;
  setPrompt: (s: string) => void;
  params: Record<string, unknown>;
  setParams: (fn: (p: Record<string, unknown>) => Record<string, unknown>) => void;
  pinnedLoras: Lora[];
  onOpenLoras: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onEnhanced: (text: string, historyId: number | null) => void;
  job: Job | null;
  onBrowseModels: () => void;
  adhocLora: string;
  setAdhocLora: (s: string) => void;
}) {
  const { toast } = useToast();
  const [enhanced, setEnhanced] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [meta, setMeta] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const busy = job?.status === "running" || job?.status === "queued";
  const missingRequired = Object.entries(schema?.params ?? {})
    .filter(([n, s]) => s.required && n !== "prompt" && params[n] == null)
    .map(([n, s]) => s.title || n.replace(/_/g, " "));

  /* Real estimate from the Worker, not a local guess. Debounced so typing in a
     numeric field does not fire a request per keystroke. The quote is stored
     against the params it was computed for, so "stale" is derived during render
     rather than flipped by an effect. */
  const debouncedParams = useDebounced(JSON.stringify(params), 350);
  const [quote, setQuote] = useState<{ key: string; cost: number } | null>(null);
  useEffect(() => {
    if (!model) return;
    let live = true;
    estimateCost(model, JSON.parse(debouncedParams)).then((c) => {
      if (live) setQuote({ key: `${model.id}|${debouncedParams}`, cost: c });
    });
    return () => {
      live = false;
    };
  }, [model, debouncedParams]);

  const quoteKey = model ? `${model.id}|${debouncedParams}` : "";
  const cost = quote?.key === quoteKey ? quote.cost : 0;
  const costStale = !!model && quote?.key !== quoteKey;

  async function enhance() {
    if (!prompt.trim()) {
      toast("Write a rough prompt first", "error", "The enhancer rewrites what you give it.");
      promptRef.current?.focus();
      return;
    }
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setEnhancing(true);
    setEnhanced("");
    setMeta(null);
    try {
      const r = await streamEnhance(prompt, model, setEnhanced, ac.signal, params);
      setMeta(`${r.providerUsed} · ${r.modelUsed} · ${r.text.length} chars`);
      onEnhanced(r.text, r.historyId);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("Enhance failed", "error", (e as Error).message);
    } finally {
      setEnhancing(false);
    }
  }

  const payload = JSON.stringify(
    Object.fromEntries(
      Object.entries({ model: model?.id, prompt, ...params }).filter(
        ([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length),
      ),
    ),
    null,
    2,
  );

  /* Real templates from enhancer.js. Each one names the model it was written
     for, so only templates matching the selected model are offered — offering a
     portrait prompt on a video model would be a lie. */
  const templates = useMemo(
    () => (model ? TEMPLATES.filter((t: any) => t.model === model.id) : []),
    [model],
  );

  return (
    <section aria-label="Prompt composer" className="flex min-h-0 flex-col gap-3">
      {/* ---------- selected model summary ---------- */}
      <div className="panel flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        {model ? (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-soft ring-1 ring-accent/30">
              <Icon
                name={
                  model.group === "image"
                    ? "image"
                    : model.group === "video"
                      ? "video"
                      : model.group === "audio"
                        ? "audio"
                        : model.group === "3d"
                          ? "cube"
                          : "text"
                }
              />
            </span>
            <div className="min-w-0 flex-1">
              <ModelName name={model.name} className="block text-fine font-semibold text-t1" />
              <p className="truncate text-micro text-t3">
                {model.category}
                {model.family ? ` · ${model.family}` : ""}
                {/* Derived from the real schema's duration parameter, absent otherwise. */}
                {model.durationHint ? ` · ${model.durationHint}` : ""}
              </p>
            </div>
            <Tip text={model.summary} label={`About ${model.name}`} />
            <button type="button" onClick={onBrowseModels} className="btn btn-sm btn-ghost gap-1.5 lg:hidden">
              <Icon name="refresh" className="size-3.5" />
              Change
            </button>
          </>
        ) : (
          <div className="flex w-full items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-s3 text-t3">
              <Icon name="layers" />
            </span>
            <p className="min-w-0 flex-1 text-fine text-t2">No model selected yet.</p>
            <button type="button" onClick={onBrowseModels} className="btn btn-sm btn-primary">
              Browse catalogue
            </button>
          </div>
        )}
      </div>

      {/* ---------- the primary surface ---------- */}
      <div className="panel-primary p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-fine font-semibold uppercase tracking-[0.1em] text-accent-soft">
            Prompt
          </h2>
          <span className="tnum ml-auto text-micro text-t3">{prompt.length} chars</span>
        </div>

        <textarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the shot. Subject, lighting, lens, mood…"
          aria-label="Prompt"
          className="prompt-area"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={enhance}
            disabled={enhancing}
            className="btn btn-ghost gap-2"
            aria-busy={enhancing}
          >
            {enhancing ? <Spinner /> : <Icon name="sparkle" className="text-accent-soft" />}
            {enhancing ? "Enhancing…" : "Enhance for this model"}
          </button>

          {templates.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-micro text-t3">Start from</span>
              {templates.map((t: any) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setPrompt(t.prompt);
                    setParams((p) => ({ ...schema?.defaults, ...(t.params || {}) }));
                  }}
                  className="btn btn-sm btn-quiet ring-1 ring-line"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* streaming enhancer output, inline — not a desktop-only sidebar */}
        {(enhancing || enhanced) && (
          <div className="well mt-3 p-3" aria-live="polite">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                <Icon name="sparkle" className="size-3" />
                Enhanced
              </Badge>
              {meta && <span className="text-micro text-t3">{meta}</span>}
              {enhanced && !enhancing && (
                <div className="ml-auto flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(enhanced);
                      toast("Copied to clipboard", "success");
                    }}
                    className="btn btn-sm btn-quiet gap-1.5"
                  >
                    <Icon name="copy" className="size-3.5" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(enhanced);
                      setEnhanced("");
                      toast("Prompt replaced", "success");
                    }}
                    className="btn btn-sm btn-primary gap-1.5"
                  >
                    <Icon name="check" className="size-3.5" />
                    Use
                  </button>
                </div>
              )}
            </div>
            <p className="whitespace-pre-wrap text-fine leading-relaxed text-t1">
              {enhanced}
              {enhancing && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
            </p>
          </div>
        )}
      </div>

      {/* ---------- adapters ----------
          Pinning filters the catalogue, which is useful whether or not the
          selected model can load the adapter, so this is always available.
          Whether the *current* model accepts adapters is stated from its real
          schema instead of being assumed. */}
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <h2 className="text-fine font-semibold uppercase tracking-[0.1em] text-t3">Adapters</h2>
        {pinnedLoras.length === 0 ? (
          <span className="text-micro text-t3">None pinned</span>
        ) : (
          pinnedLoras.map((l) => (
            <Badge key={l.id} tone={l.compatTier === "unsupported" ? "warn" : "accent"}>
              <Icon name="layers" className="size-3" />
              {l.name}
            </Badge>
          ))
        )}
        {model && pinnedLoras.length > 0 && (
          <span className="text-micro text-t3">
            {model.loraCapable
              ? "This model accepts adapters — add them under Parameters."
              : "This model has no adapter parameter."}
          </span>
        )}
        <button type="button" onClick={onOpenLoras} className="btn btn-sm btn-ghost ml-auto gap-1.5">
          <Icon name="plus" className="size-3.5" />
          Manage LoRAs
        </button>
        <div className="w-full">
          <label htmlFor="adhoc-lora" className="mb-1 flex items-center gap-1.5 text-micro font-medium text-t2">
            Ad-hoc LoRA
            <Tip text="This run only — never saved. Direct .safetensors URL, HuggingFace owner/repo, full HuggingFace file URL, or civitai:ID. Merged into the run as {path, scale} at submit time." />
          </label>
          <input
            id="adhoc-lora"
            type="text"
            value={adhocLora}
            onChange={(e) => setAdhocLora(e.target.value)}
            placeholder="https://…safetensors  or  owner/repo  or  civitai:123"
            aria-label="Ad-hoc LoRA (this run only)"
            className="field font-mono"
          />
        </div>
      </div>

      {/* ---------- parameters ---------- */}
      <div className="panel p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-fine font-semibold uppercase tracking-[0.1em] text-t3">Parameters</h2>
          {schema && (
            <Badge tone="neutral">{Object.keys(schema.params).length} fields</Badge>
          )}
          {Object.keys(params).length > 0 && (
            <button
              type="button"
              onClick={() => setParams(() => ({ ...(schema?.defaults ?? {}) }))}
              className="btn btn-sm btn-quiet ml-auto gap-1.5"
            >
              <Icon name="refresh" className="size-3.5" />
              Reset to defaults
            </button>
          )}
        </div>

        {loadingSchema ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : model ? (
          <ParamForm schema={schema} values={params} onChange={setParams} />
        ) : (
          <p className="text-fine text-t3">Parameters appear once a model is selected.</p>
        )}
      </div>

      {/* ---------- payload: debug output, demoted to tertiary ---------- */}
      <div className="panel overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPayload((s) => !s)}
          aria-expanded={showPayload}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-micro text-t3 hover:text-t1"
        >
          <Icon
            name="chevronRight"
            className={`size-3.5 transition-transform ${showPayload ? "rotate-90" : ""}`}
          />
          Request payload
          <span className="ml-auto font-mono">JSON</span>
        </button>
        {showPayload && (
          <pre className="scroll-y max-h-56 overflow-auto border-t border-line bg-s0 p-3 font-mono text-micro leading-relaxed text-t2">
            {payload}
          </pre>
        )}
      </div>

      {/* ---------- action dock: always reachable ---------- */}
      {/* Sticky at every breakpoint: the primary action is never scrolled away,
          and env(safe-area-inset-bottom) keeps it clear of the gesture bar. */}
      <div className="dock-pad sticky bottom-0 z-20 -mx-3 mt-auto border-t border-line bg-s0/92 px-3 pt-3 backdrop-blur-xl sm:-mx-4 sm:px-4">
        {missingRequired.length > 0 && (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-micro text-warn ring-1 ring-warn/25">
            <Icon name="warn" className="size-4" />
            Required: {missingRequired.join(", ")}
          </p>
        )}

        {busy ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-micro">
                <span className="truncate text-t2">{job?.error ?? "Generating…"}</span>
                <span className="tnum text-t3">{Math.round((job?.progress ?? 0) * 100)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round((job?.progress ?? 0) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Generation progress"
                className="h-2 overflow-hidden rounded-full bg-s2 ring-1 ring-line"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-info transition-[width] duration-200"
                  style={{ width: `${(job?.progress ?? 0) * 100}%` }}
                />
              </div>
            </div>
            <button type="button" onClick={onCancel} className="btn btn-danger gap-2">
              <Icon name="stop" className="size-4" />
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!model || !prompt.trim() || missingRequired.length > 0}
            className="btn btn-lg btn-hero gap-2.5"
          >
            <Icon name="bolt" className="size-5" />
            Generate
            {model && (
              <span className="tnum rounded-md bg-black/25 px-2 py-1 text-fine font-semibold">
                {costStale ? "…" : `≈ $${cost.toFixed(3)}`}
              </span>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
