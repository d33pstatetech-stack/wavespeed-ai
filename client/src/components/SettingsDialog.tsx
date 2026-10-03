import { useCallback, useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, Dialog } from "../ui/primitives";
import { useToast } from "../ui/Toasts";
import useLlmConfig from "../hooks/useLlmConfig";
import { MODEL_PRESETS } from "../enhancer";

/**
 * Enhancer provider chain.
 *
 * The real /api/llm-config route: the chain is stored server-side and mirrored
 * to localStorage, and keys come back masked. Order matters — the first provider
 * that answers wins, and the Worker tries each in turn on failure.
 *
 * Edits are held in a local draft and committed explicitly, so a half-typed URL
 * is never persisted.
 */
export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { config, load, save, EMPTY_ROW } = useLlmConfig();
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setBusy(true);
    load()
      .then((c) => live && setDraft(structuredClone(c)))
      .catch(() => live && setDraft(null))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [open, load]);

  const providers: any[] = draft?.providers ?? [];
  const dirty = draft && config && JSON.stringify(draft) !== JSON.stringify(config);

  const patch = (i: number, p: Record<string, unknown>) =>
    setDraft((d: any) => {
      const next = structuredClone(d);
      Object.assign(next.providers[i], p);
      return next;
    });

  const commit = async () => {
    if (!draft) return;
    try {
      await save(draft);
      toast("Enhancer chain saved", "success");
    } catch (e) {
      toast("Could not save", "error", (e as Error).message);
    }
  };

  const add = () =>
    setDraft((d: any) => {
      const next = structuredClone(d);
      next.providers.push({ ...EMPTY_ROW });
      return next;
    });

  const remove = (i: number) =>
    setDraft((d: any) => {
      const next = structuredClone(d);
      next.providers.splice(i, 1);
      return next;
    });

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d: any) => {
      const j = i + dir;
      if (j < 0 || j >= d.providers.length) return d;
      const next = structuredClone(d);
      const [p] = next.providers.splice(i, 1);
      next.providers.splice(j, 0, p);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enhancer settings"
      description="Fallback chain used by the prompt enhancer, tried top to bottom. The first provider that answers wins."
      footer={
        <>
          {dirty && <span className="mr-auto text-micro text-warn">Unsaved changes</span>}
          {!dirty && <span className="mr-auto" />}
          <button type="button" onClick={onClose} className="btn btn-quiet">
            Close
          </button>
          <button type="button" onClick={commit} disabled={!dirty} className="btn btn-primary">
            Save
          </button>
        </>
      }
    >
      {busy ? (
        <p className="text-fine text-t3">Loading configuration…</p>
      ) : !draft ? (
        <div className="grid gap-3">
          <p className="text-fine text-t3">No configuration could be read.</p>
          <button type="button" onClick={() => load().then((c) => setDraft(structuredClone(c)))} className="btn btn-primary w-fit gap-2">
            <Icon name="refresh" className="size-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {providers.map((p, i) => (
            <div key={i} className="rounded-xl bg-s1 p-3 ring-1 ring-line">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={i === 0 ? "accent" : "neutral"}>{i === 0 ? "Primary" : `Fallback ${i}`}</Badge>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="btn btn-sm btn-quiet" aria-label="Move up">
                    <Icon name="chevronRight" className="size-3.5 -rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === providers.length - 1}
                    className="btn btn-sm btn-quiet"
                    aria-label="Move down"
                  >
                    <Icon name="chevronRight" className="size-3.5 rotate-90" />
                  </button>
                  <button type="button" onClick={() => remove(i)} className="btn btn-sm btn-quiet" aria-label={`Remove provider ${i + 1}`}>
                    <Icon name="trash" className="size-3.5" />
                  </button>
                </span>
              </div>
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-micro text-t3">Base URL</span>
                  <input type="url" value={p.baseUrl ?? ""} onChange={(e) => patch(i, { baseUrl: e.target.value })} className="field font-mono" />
                </label>
                <label className="grid gap-1">
                  <span className="text-micro text-t3">Model</span>
                  <input
                    type="text"
                    list={`mp-models-${i}`}
                    value={p.model ?? ""}
                    onChange={(e) => patch(i, { model: e.target.value })}
                    placeholder="e.g. liquid/lfm-2.5-2.6b:free"
                    className="field font-mono"
                  />
                  <datalist id={`mp-models-${i}`}>
                    {Object.keys(MODEL_PRESETS || {}).map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-1">
                  <span className="text-micro text-t3">API key</span>
                  <input
                    type="password"
                    value={p.apiKey ?? ""}
                    onChange={(e) => patch(i, { apiKey: e.target.value })}
                    placeholder="leave blank to use the server-side key"
                    className="field font-mono"
                  />
                </label>
              </div>
            </div>
          ))}
          <button type="button" onClick={add} className="btn btn-ghost gap-2">
            <Icon name="plus" className="size-4" />
            Add provider
          </button>
        </div>
      )}
    </Dialog>
  );
}