import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, Dialog, EmptyState, Segmented, TierBadge, Tip } from "../ui/primitives";
import { useToast } from "../ui/Toasts";
import { resolveLoraUrl } from "../lib/api";
import { insertFormat, isConfirmed } from "../lib/loraFormats";
import type { App } from "../lib/loraFormats";
import { tierEvidenceOne, tierForOne } from "../lib/tiers";
import type { Lora, Model } from "../lib/types";

type Group_ = "all" | "aznten" | "misc" | "nsfw" | "confirmed";

export default function LoraDialog({
  open,
  onClose,
  loras,
  pinned,
  onTogglePin,
  onAddCustom,
  onRemoveCustom,
  model,
  app,
}: {
  open: boolean;
  onClose: () => void;
  loras: Lora[];
  pinned: string[];
  onTogglePin: (id: string) => void;
  onAddCustom: (l: Lora) => Promise<void>;
  onRemoveCustom: (l: Lora) => Promise<void>;
  model: Model | null;
  app: App;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<Group_>("all");

  const counts = useMemo(
    () => ({
      all: loras.length,
      aznten: loras.filter((l) => l.entry?.isAznten).length,
      misc: loras.filter((l) => l.entry && !l.entry?.isAznten && !l.entry?.isNsfw).length,
      nsfw: loras.filter((l) => l.entry?.isNsfw).length,
      confirmed: model ? loras.filter((l) => isConfirmed(app, model.id, l.id)).length : 0,
    }),
    [loras, model, app],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = loras;
    if (group === "aznten") base = base.filter((l) => l.entry?.isAznten);
    else if (group === "misc") base = base.filter((l) => l.entry && !l.entry?.isAznten && !l.entry?.isNsfw);
    else if (group === "nsfw") base = base.filter((l) => l.entry?.isNsfw);
    else if (group === "confirmed") base = model ? base.filter((l) => isConfirmed(app, model.id, l.id)) : [];
    if (s) {
      base = base.filter(
        (l) =>
          l.name.toLowerCase().includes(s) ||
          l.repo.toLowerCase().includes(s) ||
          l.triggers.some((t) => t.toLowerCase().includes(s)),
      );
    }
    // Confirmed pairs first, then pinned, then family matches.
    return [...base].sort((a, b) => {
      const ca = model && isConfirmed(app, model.id, a.id) ? 0 : 1;
      const cb = model && isConfirmed(app, model.id, b.id) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const pa = pinned.includes(a.id) ? 0 : 1;
      const pb = pinned.includes(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ma = model && a.baseFamily && a.baseFamily === model.baseFamily ? 0 : 1;
      const mb = model && b.baseFamily && b.baseFamily === model.baseFamily ? 0 : 1;
      return ma - mb || a.name.localeCompare(b.name);
    });
  }, [loras, q, group, pinned, model, app]);

  /* Real resolution through the Worker, which reads the model card to find the
     weight file, base model and trigger words. Accepts any CivitAI mirror
     (civitai.com, civitai.red, ...) because the worker normalises the host,
     plus direct .safetensors file URLs on any host (validated server-side
     with a ranged GET so a dead CDN fails visibly). */
  const ephemeralHost = /cloudfront\.net|wavespeed|replicate\.delivery|fbcdn|googleusercontent/i.test(url);
  async function resolve() {
    const raw = url.trim();
    if (!raw) return;
    const u = /:\/\//.test(raw) ? raw : `https://${raw}`;
    const customName = nameOverride.trim();
    setAdding(true);
    try {
      const res: any = await resolveLoraUrl(u);
      const found: any[] = Array.isArray(res) ? res : res.loras || res.entries || (res.repo ? [res] : []);
      if (!found.length) throw new Error("No LoRA found at that address");
      for (const f of found) {
        const name = customName || f.name || f.repo || u;
        const fmt = insertFormat(app, { ...f, name });
        await onAddCustom({
          id: String(f.id || f.file_url || f.repo || u),
          name,
          source: f.source === "direct" ? "custom" : /civitai/i.test(u) ? "civitai" : "huggingface",
          repo: String(f.repo || f.id || u),
          baseFamily: "",
          triggers: Array.isArray(f.triggers) ? f.triggers : [],
          custom: true,
          entry: { ...f, name },
        });
        if (fmt) {
          toast(`Added ${name}`, "success", `Paste this into the field: ${fmt.value}`);
        }
      }
      setUrl("");
      setNameOverride("");
      toast(`Added ${found.length} adapter${found.length === 1 ? "" : "s"}`, "success");
    } catch (e) {
      const msg = (e as Error).message || "";
      if (/timed out|timeout|aborted|abort/i.test(msg)) toast("Resolve timed out", "error", msg);
      else toast("Could not resolve that URL", "error", msg);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="LoRA adapters"
      description="Pin adapters to filter the catalogue. Adapters marked Confirmed produced a real image with this model."
      size="lg"
      footer={
        <>
          <span className="mr-auto text-micro text-t3">
            {pinned.length} pinned · {loras.length} in library
            {model && counts.confirmed > 0 ? ` · ${counts.confirmed} confirmed for this model` : ""}
          </span>
          <button type="button" onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="well p-3">
          <label htmlFor="lora-url" className="mb-1.5 flex items-center gap-1.5 text-fine font-medium text-t1">
            Add from URL
            <Tip text="HuggingFace, any CivitAI mirror (including civitai.red), or a direct .safetensors file URL. The Worker reads the model card (or validates the file with a ranged GET) to find the weight file, base model and trigger words." />
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="lora-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resolve()}
              placeholder="https://huggingface.co/owner/repo  or  https://…safetensors"
              className="field min-w-0 flex-1 font-mono"
            />
            <input
              id="lora-name"
              type="text"
              value={nameOverride}
              onChange={(e) => setNameOverride(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resolve()}
              placeholder="Name (optional) — e.g. aznten-style"
              aria-label="Custom name (optional)"
              className="field w-44"
            />
            <button type="button" onClick={resolve} disabled={adding || !url.trim()} className="btn btn-primary gap-2">
              {adding ? <Icon name="refresh" className="size-4" /> : <Icon name="plus" className="size-4" />}
              {adding ? "Resolving…" : "Resolve"}
            </button>
          </div>
          {ephemeralHost && (
            <p className="mt-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-micro text-warn ring-1 ring-warn/25">
              Temporary CDN links expire — upload to HuggingFace for a permanent entry
            </p>
          )}
        </div>

        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search library…"
            aria-label="Search LoRA library"
            className="field pl-9"
          />
        </div>

        <Segmented
          value={group}
          onChange={setGroup}
          label="Filter by group"
          options={[
            { value: "all", label: `All ${counts.all}` },
            ...(counts.confirmed > 0 ? [{ value: "confirmed" as Group_, label: `Confirmed ${counts.confirmed}` }] : []),
            { value: "aznten", label: `Aznten ${counts.aznten}` },
            { value: "misc", label: `Misc ${counts.misc}` },
            { value: "nsfw", label: `NSFW ${counts.nsfw}` },
          ]}
        />

        {list.length === 0 ? (
          <EmptyState title="No adapters match" hint="Try a different term, or add one from a URL above." />
        ) : (
          <ul className="grid gap-2">
            {list.map((l) => {
              const on = pinned.includes(l.id);
              const tier = model ? tierForOne(model, l, app) : null;
              const confirmed = !!model && isConfirmed(app, model.id, l.id);
              const fmt = insertFormat(app, l.entry || { repo_url: l.repo, file_url: l.entry?.file_url });
              return (
                <li key={l.id}>
                  <div
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-2.5 ring-1 transition ${
                      confirmed ? "bg-pass/8 ring-pass/35" : on ? "bg-accent/12 ring-accent/40" : "bg-s1 ring-line hover:ring-line2"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onTogglePin(l.id)}
                      aria-pressed={on}
                      className={`hit grid size-9 shrink-0 place-items-center rounded-lg transition ${
                        on ? "bg-accent text-white" : "bg-s3 text-t3 hover:text-t1"
                      }`}
                      aria-label={on ? `Unpin ${l.name}` : `Pin ${l.name}`}
                    >
                      <Icon name="pin" className="size-4" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-fine font-medium text-t1">{l.name}</p>
                      <p className="truncate font-mono text-micro text-t3">{l.repo}</p>
                    </div>

                    {confirmed ? (
                      <Badge tone="pass">
                        <Icon name="check" className="size-3" />
                        Confirmed
                      </Badge>
                    ) : (
                      tier && <TierBadge tier={tier} evidence={tierEvidenceOne(model, l)} />
                    )}
                    <Badge tone="neutral">
                      {l.source === "civitai" ? "CivitAI" : l.source === "custom" ? "Custom" : "HF"}
                    </Badge>

                    {fmt && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(fmt.value);
                          toast("Copied the format this app accepts", "success", fmt.note);
                        }}
                        className="btn btn-sm btn-quiet gap-1.5"
                        aria-label={`Copy the accepted value for ${l.name}`}
                      >
                        <Icon name="copy" className="size-3.5" />
                        Copy value
                      </button>
                    )}

                    {l.custom && (
                      <button
                        type="button"
                        onClick={() => onRemoveCustom(l)}
                        className="btn btn-sm btn-quiet gap-1.5"
                        aria-label={`Remove ${l.name} from library`}
                      >
                        <Icon name="trash" className="size-3.5" />
                      </button>
                    )}

                    {fmt && <p className="w-full font-mono text-micro text-t3">{fmt.note}</p>}

                    {l.triggers.length > 0 && (
                      <p className="w-full text-micro text-t3">
                        Triggers:{" "}
                        {l.triggers.map((t) => (
                          <code key={t} className="mr-1 rounded bg-s0 px-1.5 py-0.5 font-mono text-t2">
                            {t}
                          </code>
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}