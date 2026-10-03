import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, Dialog, EmptyState, Segmented, TierBadge, Tip } from "../ui/primitives";
import { useToast } from "../ui/Toasts";
import { resolveLoraUrl } from "../lib/api";
import type { Lora, Model } from "../lib/types";

type Group_ = "all" | "aznten" | "misc" | "nsfw";

export default function LoraDialog({
  open,
  onClose,
  loras,
  pinned,
  onTogglePin,
  onAddCustom,
  onRemoveCustom,
  model,
}: {
  open: boolean;
  onClose: () => void;
  loras: Lora[];
  pinned: string[];
  onTogglePin: (id: string) => void;
  onAddCustom: (l: Lora) => Promise<void>;
  onRemoveCustom: (l: Lora) => Promise<void>;
  model: Model | null;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<Group_>("all");

  const counts = useMemo(
    () => ({
      all: loras.length,
      aznten: loras.filter((l) => l.entry?.isAznten).length,
      misc: loras.filter((l) => l.entry && !l.entry?.isAznten && !l.entry?.isNsfw).length,
      nsfw: loras.filter((l) => l.entry?.isNsfw).length,
    }),
    [loras],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = loras;
    if (group === "aznten") base = base.filter((l) => l.entry?.isAznten);
    else if (group === "misc") base = base.filter((l) => l.entry && !l.entry?.isAznten && !l.entry?.isNsfw);
    else if (group === "nsfw") base = base.filter((l) => l.entry?.isNsfw);
    if (s) {
      base = base.filter(
        (l) =>
          l.name.toLowerCase().includes(s) ||
          l.repo.toLowerCase().includes(s) ||
          l.triggers.some((t) => t.toLowerCase().includes(s)),
      );
    }
    // Pinned first, then adapters that match the selected model's family.
    return [...base].sort((a, b) => {
      const pa = pinned.includes(a.id) ? 0 : 1;
      const pb = pinned.includes(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ma = model && a.baseFamily && a.baseFamily === model.baseFamily ? 0 : 1;
      const mb = model && b.baseFamily && b.baseFamily === model.baseFamily ? 0 : 1;
      return ma - mb || a.name.localeCompare(b.name);
    });
  }, [loras, q, group, pinned, model]);

  /* Real resolution through the Worker, which fetches the model card and works
     out the weight file, base model and trigger words. The mockup regex-parsed
     the URL in the browser and guessed the rest. */
  async function resolve() {
    const u = url.trim();
    if (!u) return;
    setAdding(true);
    try {
      const res: any = await resolveLoraUrl(u);
      const found: any[] = Array.isArray(res) ? res : res.loras || res.entries || (res.repo ? [res] : []);
      if (!found.length) throw new Error("No LoRA found at that address");
      for (const f of found) {
        await onAddCustom({
          id: String(f.id || f.repo || u),
          name: f.name || f.repo || u,
          source: /civitai/i.test(u) ? "civitai" : "huggingface",
          repo: String(f.repo || f.id || u),
          baseFamily: "",
          triggers: Array.isArray(f.triggers) ? f.triggers : [],
          custom: true,
          entry: f,
        });
      }
      setUrl("");
      toast(`Added ${found.length} adapter${found.length === 1 ? "" : "s"}`, "success", found.map((f) => f.name || f.repo).join(", "));
    } catch (e) {
      toast("Could not resolve that URL", "error", (e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="LoRA adapters"
      description="Pin adapters to filter the catalogue to models that can actually load them."
      size="lg"
      footer={
        <>
          <span className="mr-auto text-micro text-t3">
            {pinned.length} pinned · {loras.length} in library
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
            <Tip text="Paste a Hugging Face or CivitAI model-card link. The Worker reads the model card to find the weight file, base model and trigger words." />
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="lora-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resolve()}
              placeholder="https://huggingface.co/owner/repo"
              className="field min-w-0 flex-1"
            />
            <button type="button" onClick={resolve} disabled={adding || !url.trim()} className="btn btn-primary gap-2">
              {adding ? <Icon name="refresh" className="size-4" /> : <Icon name="plus" className="size-4" />}
              {adding ? "Resolving…" : "Resolve"}
            </button>
          </div>
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
              return (
                <li key={l.id}>
                  <div
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-2.5 ring-1 transition ${
                      on ? "bg-accent/12 ring-accent/40" : "bg-s1 ring-line hover:ring-line2"
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

                    {l.compatTier && <TierBadge tier={l.compatTier} />}
                    <Badge tone="neutral">
                      {l.source === "civitai" ? "CivitAI" : l.source === "custom" ? "Custom" : "HF"}
                    </Badge>

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