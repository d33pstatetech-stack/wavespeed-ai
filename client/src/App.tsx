import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./ui/Icon";
import { Badge, Dialog, Spinner } from "./ui/primitives";
import { ToastProvider, useToast } from "./ui/Toasts";
import CatalogPane from "./components/CatalogPane";
import Composer from "./components/Composer";
import ResultsPane from "./components/ResultsPane";
import LoraDialog from "./components/LoraDialog";
import SettingsDialog from "./components/SettingsDialog";
import {
  deleteCustomLora as apiDeleteCustom,
  estimateCost,
  fetchCustomLoras,
  fetchLibrary,
  fetchLoraEvidence,
  fetchModels,
  fetchSchema,
  fetchVerifications,
  runGeneration,
  saveCustomLora,
  toLora,
  withSchema,
} from "./lib/api";
import { tierFor } from "./lib/tiers";
import type { App } from "./lib/loraFormats";
import { insertFormat, setCentralConfirmed } from "./lib/loraFormats";
import { setCentralVerified, setRunEvidence } from "./lora-compat";
import { useMediaQuery, usePersistentState } from "./lib/hooks";
import { USER_LORAS, NSFW_LORAS, isAzntenLora } from "./loras-data";
import { buildSubmitParams } from "./params";
import { rateJob } from "./api";
import type { Job, Lora, Model, ModelSchema, Run } from "./lib/types";

type Tab = "models" | "compose" | "results";

/* Real library from loras-data.js: the owner's curated set, their private
   repos, and the NSFW group, tagged for the filter in the dialog. */
function seedLibrary(): Lora[] {
  const tagged = (e: any, isNsfw = false) => ({ ...e, isAznten: isAzntenLora(e), isNsfw });
  const out: Lora[] = [];
  const push = (e: any, isNsfw = false) => out.push(toLora(tagged(e, isNsfw)));
  USER_LORAS.forEach((e: any) => push(e));
  NSFW_LORAS.forEach((e: any) => push(e, true));
  return out;
}

/* Which provider this build talks to. Decides the LoRA value format the UI
   offers, and which confirmed model+LoRA pairs count as verified. */
const APP_ID: App = 'wavespeed';

/* Customs flow through the same regex-on-name grouping as the seed library,
   so a custom named aznten-* lands in the Aznten tab. Seed grouping is
   unchanged. */
function tagCustomEntry(entry: any) {
  return { ...entry, isAznten: isAzntenLora(entry), isNsfw: !!entry?.nsfw };
}

/* Central row → seed-entry shape. isAznten comes from group_name (never the
   regex); isNsfw from nsfw. baseFamily mirrors base_family because toLora
   reads the camelCase key. Customs keep the regex path above. */
function centralEntryForRow(row: any) {
  let triggers: any[] = [];
  if (Array.isArray(row?.triggers)) triggers = row.triggers;
  else {
    try {
      const t = JSON.parse(row?.triggers_json || "[]");
      if (Array.isArray(t)) triggers = t;
    } catch {
      triggers = [];
    }
  }
  return {
    id: String(row?.id ?? row?.repo ?? ""),
    name: String(row?.name ?? row?.id ?? ""),
    source: String(row?.source ?? ""),
    repo: String(row?.repo ?? row?.id ?? ""),
    repo_url: String(row?.repo_url ?? ""),
    file: String(row?.file ?? ""),
    file_url: String(row?.file_url ?? ""),
    base_model: String(row?.base_model ?? ""),
    base_family: String(row?.base_family ?? ""),
    baseFamily: String(row?.base_family ?? ""),
    pipeline: String(row?.pipeline ?? "text-to-image"),
    triggers,
    isNsfw: !!row?.nsfw,
    isAznten: row?.group_name === "aznten",
    note: String(row?.note ?? ""),
    suggested_target: String(row?.suggested_target ?? ""),
    muapi_model: String(row?.muapi_model ?? ""),
    replicate_model: String(row?.replicate_model ?? ""),
    wavespeed_model: String(row?.wavespeed_model ?? ""),
    custom: false,
  };
}

/* Ad-hoc LoRA (this run only, never saved): direct .safetensors URL, HF
   owner/repo, full HF file URL, or civitai:ID → entry for insertFormat. */
function adhocEntryForInput(raw: string): any {
  const t = String(raw || '').trim();
  if (!t) return null;
  const cm = t.match(/^civitai:(\d+)(?:@\d+)?$/i);
  if (cm) return { id: `civitai:${cm[1]}`, repo_url: `https://civitai.com/models/${cm[1]}` };
  let withScheme = /:\/\//.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (/\.safetensors$/i.test(u.pathname)) return { file_url: u.toString(), repo_url: u.toString() };
    const hm = withScheme.match(/huggingface\.co\/([^/\s?#]+)\/([^/\s?#]+)/i);
    if (hm) {
      const repo = `${hm[1]}/${hm[2].replace(/\/$/, '')}`;
      return { id: repo, repo_url: `https://huggingface.co/${repo}` };
    }
  } catch { /* not a URL — fall through to bare repo */ }
  if (/^[^/\s:]+\/[^/\s:]+$/.test(t)) return { id: t };
  if (/^https?:\/\//i.test(withScheme)) return { file_url: withScheme, repo_url: withScheme };
  return { file_url: t, repo_url: t };
}

function Console() {
  const { toast, toastUndo } = useToast();

  const [models, setModels] = useState<Model[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [selectedId, setSelectedId] = usePersistentState<string | null>("mp.model", null);
  const [schema, setSchema] = useState<ModelSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [prompt, setPrompt] = usePersistentState("mp.prompt", "");
  const [runs, setRuns] = usePersistentState<Run[]>("mp.runs", []);
  const [job, setJob] = useState<Job | null>(null);
  const [pinned, setPinned] = usePersistentState<string[]>("mp.pinned", []);
  const [tab, setTab] = useState<Tab>("compose");
  const [loraOpen, setLoraOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enhancementId, setEnhancementId] = useState<number | null>(null);
  const [library, setLibrary] = useState<Lora[]>(seedLibrary);
  /* Ad-hoc LoRA for this run only — never saved to the library or D1. */
  const [adhocLora, setAdhocLora] = useState("");

  const abort = useRef<AbortController | null>(null);

  const wide = useMediaQuery("(min-width: 90rem)");
  const mid = useMediaQuery("(min-width: 64rem)");

  /* ---------------- catalogue: real models from D1 ---------------- */
  useEffect(() => {
    let live = true;
    fetchModels()
      .then(({ models: m, statsFailed: sf }) => {
        if (!live) return;
        setModels(m);
        setStatsFailed(sf);
        setLoadingCatalog(false);
      })
      .catch((e) => {
        if (!live) return;
        setCatalogError((e as Error).message);
        setLoadingCatalog(false);
        toast("Could not load the catalogue", "error", (e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [toast]);

  /* ---------------- central LoRA library (Phase A read-only) ---------------- */
  /* Replaces the baked seed ONLY when the fetch returns a non-empty array;
     offline or pre-migration DBs keep the baked USER_LORAS/NSFW_LORAS. */
  useEffect(() => {
    let live = true;
    fetchLibrary().then((rows) => {
      if (!live) return;
      if (!Array.isArray(rows) || !rows.length) return;
      const central = rows.map((r: any) => toLora(centralEntryForRow(r)));
      setLibrary((ls) => {
        const customs = ls.filter((l) => l.custom);
        const customIds = new Set(customs.map((c) => c.id));
        return [...central.filter((l) => !customIds.has(l.id)), ...customs];
      });
    });
    return () => {
      live = false;
    };
  }, []);

  /* ---------------- server-stored custom LoRAs ---------------- */
  useEffect(() => {
    let live = true;
    fetchCustomLoras().then((rows) => {
      if (!live || !rows.length) return;
      setLibrary((ls) => {
        const have = new Set(ls.map((l) => l.id));
        return [...ls, ...rows.filter((r: any) => !have.has(String(r.id))).map((r: any) => toLora(tagCustomEntry(r), true))];
      });
    });
    return () => {
      live = false;
    };
  }, []);

  /* ---------------- central verifications → confirmed/verified ---------------- */
  /* Builds the confirmed/verified lookup from central verifications
     (lora_id+model_id+app==='wavespeed') FIRST; when central is empty the
     baked CONFIRMED_LORA_RUNS/VERIFIED_LORA_RUNS stay in force (the setters
     are no-ops for empty input). No format/compat logic changes. */
  useEffect(() => {
    let live = true;
    fetchVerifications().then((rows) => {
      if (!live) return;
      if (!Array.isArray(rows) || !rows.length) return;
      const ws = rows.filter((v: any) => v && v.app === "wavespeed" && v.lora_id && v.model_id);
      if (!ws.length) return;
      const byModel = new Map<string, string[]>();
      for (const v of ws) {
        const m = String(v.model_id);
        const l = String(v.lora_id);
        if (!byModel.has(m)) byModel.set(m, []);
        if (!byModel.get(m)!.includes(l)) byModel.get(m)!.push(l);
      }
      setCentralConfirmed([...byModel].map(([model, loras]) => ({ model, loras, apps: ["wavespeed" as const] })));
      setCentralVerified(ws.map((v: any) => ({ lora: String(v.lora_id), model: String(v.model_id), job: String(v.job_id ?? ""), when: String(v.ran_at ?? "") })));
    });
    return () => {
      live = false;
    };
  }, []);

  /* ---------------- K5: rated-run evidence → verified tier ------------------
     LoRA+model pairs a person actually rated 4-5★ with the adapter loaded.
     Installed AFTER central verifications so a seeded row keeps priority, and
     never when the fetch fails or returns nothing — null/empty leaves every
     verdict exactly as it was. */
  useEffect(() => {
    let live = true;
    fetchLoraEvidence().then((payload) => {
      if (!live || !payload) return;
      setRunEvidence(payload);
    });
    return () => {
      live = false;
    };
  }, []);

  /* ---------------- schema for the selected model ---------------- */
  const baseModel = useMemo(() => models.find((m) => m.id === selectedId) ?? null, [models, selectedId]);
  const [schemaFor, setSchemaFor] = useState<string | null>(null);
  const model = useMemo(
    () => (schemaFor === selectedId ? withSchema(baseModel, schema) : baseModel),
    [baseModel, schema, schemaFor, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setSchema(null);
      setSchemaFor(null);
      return;
    }
    let live = true;
    setLoadingSchema(true);
    fetchSchema(selectedId)
      .then((s) => {
        if (!live) return;
        setSchema(s);
        setSchemaFor(selectedId);
        setParams({ ...s.defaults });
      })
      .catch((e) => toast("Could not load parameters", "error", (e as Error).message))
      .finally(() => live && setLoadingSchema(false));
    return () => {
      live = false;
    };
  }, [selectedId, toast]);

  /* ---------------- job state visible from another tab ---------------- */
  useEffect(() => {
    document.title =
      job?.status === "running" ? `● ${Math.round(job.progress * 100)}% — generating… · MuAPI Console` : "MuAPI Prompt Console";
  }, [job?.status, job?.progress]);

  /* ---------------- shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        if (!mid) setTab("models");
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const focusCatalogSearch = useCallback(() => {
    if (!mid) setTab("models");
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
  }, [mid]);

  const selectModel = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (!mid) setTab("compose");
    },
    [mid, setSelectedId],
  );

  /* ---------------- pinned adapters, with live tier ---------------- */
  const pinnedLoras = useMemo(
    () =>
      pinned
        .map((id) => library.find((l) => l.id === id))
        .filter(Boolean)
        .map((l) => ({ ...(l as Lora), compatTier: tierFor(model, [l as Lora], APP_ID) })) as Lora[],
    [pinned, library, model],
  );

  /* ---------------- generation ---------------- */
  const generate = useCallback(async () => {
    if (!model || !prompt.trim() || job?.status === "running") return;
    const ac = new AbortController();
    abort.current = ac;
    const started = Date.now();
    const submitParams = buildSubmitParams(prompt, params);
    // Ad-hoc LoRA (this run only, never saved): convert via insertFormat and
    // merge into the run input's loras value as {path, scale} objects.
    const adhocRaw = adhocLora.trim();
    if (adhocRaw) {
      const entry = adhocEntryForInput(adhocRaw);
      const fmt = entry ? insertFormat(APP_ID, entry) : null;
      const path = fmt ? fmt.value : adhocRaw;
      const obj = { path, scale: 1 };
      let key = "loras";
      if (Array.isArray((submitParams as any).loras)) key = "loras";
      else if (Array.isArray((submitParams as any).lora_list)) key = "lora_list";
      else {
        const existing = Object.keys(submitParams).find((k) => /lora|adapter/i.test(k));
        if (existing) key = existing;
        else if (schema) {
          const found = Object.keys(schema.params || {}).find(
            (k) => /lora|adapter/i.test(k) && !/scale|strength|weight/i.test(k),
          );
          if (found) key = found;
        }
      }
      const cur = (submitParams as any)[key];
      if (Array.isArray(cur)) (submitParams as any)[key] = [...cur, obj];
      else if (cur && typeof cur === "object") (submitParams as any)[key] = [cur, obj];
      else (submitParams as any)[key] = [obj];
    }
    const kind = model.group === "video" ? "video" : "image";

    let cost = model.cost || 0;
    try {
      cost = await estimateCost(model, submitParams);
    } catch {
      /* base cost is fine */
    }

    const base: Job = {
      id: `job_${started}`,
      modelId: model.id,
      prompt,
      status: "running",
      progress: 0,
      startedAt: started,
      elapsedMs: 0,
      outputs: [],
      kind,
      cost,
    };
    setJob(base);
    if (!mid) setTab("results");

    try {
      const r = await runGeneration(
        model,
        submitParams,
        (p, phase) => setJob((j) => (j ? { ...j, progress: p, error: phase } : j)),
        ac.signal,
      );
      const elapsed = Date.now() - started;
      const run: Run = {
        id: r.requestId,
        modelId: model.id,
        prompt,
        outputs: r.outputs,
        kind,
        cost: r.cost || cost,
        elapsedMs: elapsed,
        at: Date.now(),
      };
      setRuns((rs) => [run, ...rs].slice(0, 60));
      setJob({ ...base, status: "done", progress: 1, elapsedMs: elapsed, outputs: r.outputs, error: undefined });
      setEnhancementId(null);
      toast(
        `Generated ${r.outputs.length} output${r.outputs.length === 1 ? "" : "s"}`,
        "success",
        `$${(r.cost || cost).toFixed(4)} · ${(elapsed / 1000).toFixed(1)}s`,
      );
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification("Generation complete", { body: model.name });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setJob((j) => (j ? { ...j, status: "cancelled", error: "Cancelled" } : j));
        toast("Generation cancelled", "info");
      } else {
        setJob((j) => (j ? { ...j, status: "error", error: (e as Error).message } : j));
        toast("Generation failed", "error", (e as Error).message);
      }
    }
  }, [model, prompt, params, adhocLora, schema, job?.status, mid, setRuns, toast]);

  const onEnhanced = useCallback((_text: string, historyId: number | null) => setEnhancementId(historyId), []);

  const togglePin = useCallback(
    (id: string) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [setPinned],
  );

  const addCustom = useCallback(
    async (l: Lora) => {
      const taggedEntry = tagCustomEntry({ ...(l.entry || {}), name: l.name, id: l.id });
      const tagged: Lora = { ...l, entry: taggedEntry };
      setLibrary((ls) => [tagged, ...ls.filter((x) => x.id !== tagged.id)]);
      // The D1 validator speaks hf/civitai/direct; the UI badge speaks
      // huggingface/civitai/custom. Translate at the save boundary, otherwise
      // a resolved adapter is accepted locally but rejected by the server and
      // silently lost on the next refresh.
      const src = String((tagged.entry as any)?.source || "");
      const serverSource = src === "custom" ? "direct" : src === "huggingface" ? "hf" : src || "direct";
      try {
        const saved: any = await saveCustomLora({
          ...((tagged.entry as any) || { repo: tagged.repo, name: tagged.name }),
          source: serverSource,
        });
        if (saved && saved.deduplicated) toast(`Already in your library: ${tagged.name}`, "info");
      } catch (e) {
        toast("Saved locally, but the server rejected it", "error", (e as Error).message);
      }
    },
    [toast],
  );

  const removeCustom = useCallback(
    async (l: Lora) => {
      const snapshot = library;
      setLibrary((ls) => ls.filter((x) => x.id !== l.id));
      setPinned((p) => p.filter((x) => x !== l.id));
      toastUndo(
        `Removed ${l.name}`,
        async () => {
          setLibrary(snapshot);
        },
        () => {},
      );
      try {
        await apiDeleteCustom((l.entry as any)?.id ?? l.id);
      } catch {
        /* restored by undo if it matters */
      }
    },
    [library, setPinned, toastUndo],
  );

  const clearHistory = useCallback(() => {
    const snapshot = runs;
    setRuns([]);
    toastUndo(
      `Cleared ${snapshot.length} run${snapshot.length === 1 ? "" : "s"}`,
      () => {},
      () => setRuns(snapshot),
    );
  }, [runs, setRuns, toastUndo]);

  /* Ratings are real and server-side, so the average feeds back into the
     catalogue's "most used" and star display on the next load. Server-first:
     the star only sticks when the POST lands, and a failure toasts instead
     of silently diverging from the server (which would starve K5 evidence). */
  const rate = useCallback(
    async (id: string, n: number) => {
      try {
        await rateJob({ externalJobId: id, rating: n });
        setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, rating: n } : r)));
      } catch (e) {
        toast("Rating not saved", "error", (e as Error).message);
      }
    },
    [setRuns, toast],
  );

  const reuse = useCallback(
    (r: Run) => {
      setPrompt(r.prompt);
      setSelectedId(r.modelId);
      if (!mid) setTab("compose");
      setResultsOpen(false);
    },
    [mid, setPrompt, setSelectedId],
  );

  const resultCount = runs.reduce((n, r) => n + r.outputs.length, 0);
  const familyCount = useMemo(() => new Set(models.map((m) => m.family).filter(Boolean)).size, [models]);

  const catalogue = <CatalogPane models={models} selectedId={selectedId} onSelect={selectModel} pinnedLoras={pinnedLoras} onClearPins={() => setPinned([])} />;

  const composer = (
    <Composer
      model={model}
      schema={schema}
      loadingSchema={loadingSchema}
      prompt={prompt}
      setPrompt={setPrompt}
      params={params}
      setParams={setParams}
      pinnedLoras={pinnedLoras}
      onOpenLoras={() => setLoraOpen(true)}
      onGenerate={generate}
      onCancel={() => abort.current?.abort()}
      onEnhanced={onEnhanced}
      job={job}
      onBrowseModels={focusCatalogSearch}
      adhocLora={adhocLora}
      setAdhocLora={setAdhocLora}
    />
  );

  const results = (
    <ResultsPane job={job} runs={runs} models={models} onRate={rate} onReuse={reuse} onClear={clearHistory} />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-s0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white">
        Skip to main content
      </a>

      <header className="z-30 shrink-0 border-b border-line bg-s0/95 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-indigo-600 text-white shadow-e1">
            <Icon name="sparkle" className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lede font-bold leading-tight text-t1">Prompt Console</h1>
            <p className="hidden text-micro text-t3 sm:block">
              {loadingCatalog
                ? "Loading catalogue…"
                : catalogError
                  ? "Catalogue unavailable"
                  : `${models.length.toLocaleString()} models · ${familyCount} families`}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {loadingCatalog ? (
              <Badge tone="neutral">
                <Spinner className="size-3" />
                Syncing
              </Badge>
            ) : catalogError ? (
              <Badge tone="crit">
                <Icon name="warn" className="size-3" />
                Offline
              </Badge>
            ) : (
              <Badge tone="pass">
                <span className="size-1.5 rounded-full bg-pass" aria-hidden="true" />
                <span className="tnum">{models.length.toLocaleString()}</span>
                <span className="sr-only">models available</span>
              </Badge>
            )}

            {mid && !wide && (
              <button type="button" onClick={() => setResultsOpen(true)} className="btn btn-sm btn-ghost gap-1.5">
                <Icon name="history" className="size-4" />
                Results
                {resultCount > 0 && <span className="tnum">{resultCount}</span>}
              </button>
            )}

            <button type="button" onClick={() => setAboutOpen(true)} aria-label="About this console" className="btn btn-icon btn-quiet">
              <Icon name="info" />
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Enhancer settings" className="btn btn-icon btn-quiet">
              <Icon name="settings" />
            </button>
          </div>
        </div>

        {!mid && (
          <div className="flex gap-1 border-t border-line px-2 pb-2 pt-1.5">
            {(
              [
                ["models", "Models", "layers"],
                ["compose", "Compose", "wand"],
                ["results", "Results", "image"],
              ] as const
            ).map(([k, label, icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-current={tab === k ? "page" : undefined}
                className={`btn flex-1 gap-1.5 ${tab === k ? "bg-accent/18 text-accent-soft ring-1 ring-accent/35" : "btn-quiet"}`}
              >
                <Icon name={icon} className="size-4" />
                {label}
                {k === "results" && resultCount > 0 && <span className="tnum rounded bg-s3 px-1.5 text-micro text-t2">{resultCount}</span>}
              </button>
            ))}
          </div>
        )}
      </header>

      <main
        id="main"
        className="grid min-h-0 flex-1 gap-3 p-3 sm:gap-4 sm:p-4
                   grid-cols-1
                   lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]
                   2xl:grid-cols-[minmax(18rem,21rem)_minmax(0,1.5fr)_minmax(20rem,1fr)]"
        style={{ maxWidth: "min(100%, 2400px)", marginInline: "auto", width: "100%" }}
      >
        {mid ? (
          <>
            {catalogue}
            <div className="scroll-y min-h-0">{composer}</div>
            {wide && results}
          </>
        ) : (
          <div className="scroll-y min-h-0">
            {tab === "models" && catalogue}
            {tab === "compose" && composer}
            {tab === "results" && results}
          </div>
        )}
      </main>

      <LoraDialog
        open={loraOpen}
        onClose={() => setLoraOpen(false)}
        loras={library}
        pinned={pinned}
        onTogglePin={togglePin}
        onAddCustom={addCustom}
        onRemoveCustom={removeCustom}
        model={model}
        app={APP_ID}
      />

      <Dialog open={resultsOpen && mid && !wide} onClose={() => setResultsOpen(false)} title="Results" size="lg">
        <div className="h-[60dvh]">{results}</div>
      </Dialog>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Dialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="What this console is"
        description="The redesign, now running against the real Worker."
        footer={
          <button type="button" onClick={() => setAboutOpen(false)} className="btn btn-primary">
            Close
          </button>
        }
      >
        <ul className="grid gap-2.5">
          {[
            ["Real catalogue", `${models.length.toLocaleString()} active models read from D1, with real run counts and average ratings from your own history.`],
            ["Real estimates", "Cost is quoted by the Worker's /api/estimate, not guessed in the browser."],
            ["Real streaming", "The enhancer streams from the configured OpenRouter → Venice chain over SSE."],
            ["Real adapters", "Your curated and private LoRAs, plus anything you add — resolved server-side and stored in D1 so it follows you between devices."],
            ["Compatibility you can read", "Tier comes from the existing verified/likely/incompatible logic, shown as glyph + text + colour rather than a dot."],
            ["Accessible virtualised list", "role=combobox + listbox, aria-activedescendant, arrow/Home/End/Enter/Escape. The whole catalogue, ~20 DOM nodes. Press / to focus it."],
            ["Fluid type and 44px targets", "clamp()-based scale, nothing renders below 12.5px, inputs are 16px+ so iOS never zooms on focus."],
            ["Three-pane workspace", "Fluid to 2400px. Below 1024px it becomes tabs, so Generate is never six screens away."],
            ["Honest feedback", "aria-live toasts, errors that do not self-destruct, optimistic delete with undo, and job state in the tab title."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-xl bg-s1 p-3 ring-1 ring-line">
              <p className="flex items-center gap-2 text-fine font-semibold text-t1">
                <Icon name="check" className="size-4 text-pass" />
                {t}
              </p>
              <p className="mt-1 text-micro leading-relaxed text-t3">{d}</p>
            </li>
          ))}
        </ul>
        {statsFailed && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-micro text-warn ring-1 ring-warn/25">
            Usage stats were unavailable, so run counts and ratings are hidden this session. The catalogue itself loaded normally.
          </p>
        )}
      </Dialog>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Console />
    </ToastProvider>
  );
}