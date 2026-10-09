import { useCallback, useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { Dialog, EmptyState } from "../ui/primitives";
import { cloudFileUrl, cloudList, cloudResolve } from "../api";

const IMG_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i;

interface CloudObject {
  key: string;
  size?: number;
  uploaded?: string;
}

function fmtSize(n?: number) {
  if (n == null || !isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function baseName(key: string) {
  return key.split("/").filter(Boolean).pop() || key;
}

/* R2 image picker: folder browse + flat view + name filter. Thumbnails load
   straight from /api/cloud/file; picking resolves a provider-fetchable URL
   via /api/cloud/resolve into the field (per app: re-upload, presigned URL,
   or data URI — the server decides, the field just takes the URL). */
export default function R2Picker({
  open,
  onClose,
  onPick,
  multiple = false,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  multiple?: boolean;
}) {
  const [prefix, setPrefix] = useState("");
  const [flat, setFlat] = useState(false);
  const [filter, setFilter] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [objects, setObjects] = useState<CloudObject[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string, f: boolean, c: string | null, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await cloudList({ prefix: p, flat: f, cursor: c });
      const imgs = ((data.objects || data.files || []) as CloudObject[]).filter((o) =>
        IMG_RE.test(o.key || ""),
      );
      setFolders(f ? [] : ((data.folders || data.delimitedPrefixes || []) as string[]));
      setObjects((prev) => (append ? [...prev, ...imgs] : imgs));
      setCursor(data.cursor || null);
    } catch (e) {
      setError((e as Error).message || "Could not list R2");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setResolving(null);
    load(prefix, flat, null, false);
  }, [open, prefix, flat, load]);

  const crumbs = prefix.split("/").filter(Boolean);
  const q = filter.trim().toLowerCase();
  const visible = objects.filter((o) => !q || baseName(o.key).toLowerCase().includes(q));

  async function pick(key: string, stayOpen: boolean) {
    setResolving(key);
    setError(null);
    try {
      const j: any = await cloudResolve(key);
      if (!j || !j.url) throw new Error("Resolve returned no URL");
      onPick(j.url);
      if (stayOpen) setSelected(null);
      else onClose();
    } catch (e) {
      setError((e as Error).message || "Resolve failed");
    } finally {
      setResolving(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pick from R2"
      description="Previously uploaded images. Picking resolves a provider-fetchable URL into the field."
      size="lg"
      footer={
        <>
          <span className="mr-auto text-micro text-t3">
            {objects.length} image{objects.length === 1 ? "" : "s"}
            {cursor ? " · more below" : ""}
          </span>
          <button type="button" onClick={onClose} className="btn btn-quiet">
            {multiple ? "Done" : "Close"}
          </button>
          <button
            type="button"
            onClick={() => selected && pick(selected, multiple)}
            disabled={!selected || resolving !== null}
            className="btn btn-primary gap-2"
          >
            {resolving ? (
              <Icon name="refresh" className="size-4 animate-spin" />
            ) : (
              <Icon name="check" className="size-4" />
            )}
            {resolving ? "Resolving…" : multiple ? "Add image" : "Use image"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrefix("")}
            disabled={!prefix && !flat}
            className="btn btn-sm btn-quiet"
            aria-label="R2 root"
          >
            R2
          </button>
          {crumbs.map((c, i) => (
            <span key={`${c}-${i}`} className="flex items-center gap-2">
              <span className="text-t4">/</span>
              <button
                type="button"
                onClick={() => setPrefix(`${crumbs.slice(0, i + 1).join("/")}/`)}
                className="btn btn-sm btn-quiet max-w-32 truncate"
              >
                {c}
              </button>
            </span>
          ))}
          <label className="ml-auto flex min-h-9 cursor-pointer items-center gap-2 text-micro text-t2">
            <input
              type="checkbox"
              checked={flat}
              onChange={(e) => setFlat(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            Flat view
          </label>
        </div>

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t3"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by filename…"
            aria-label="Filter images by filename"
            className="field pl-9"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-crit/10 px-2.5 py-1.5 text-micro text-crit ring-1 ring-crit/25"
          >
            {error}
          </p>
        )}

        {!flat && folders.length > 0 && (
          <ul className="grid gap-1.5">
            {folders.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => setPrefix(f)}
                  className="flex w-full items-center gap-2 rounded-lg bg-s1 p-2 text-left ring-1 ring-line hover:ring-line2"
                >
                  <Icon name="chevronRight" className="size-4 shrink-0 text-t3" />
                  <span className="truncate font-mono text-fine text-t2">{baseName(f.replace(/\/$/, ""))}/</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {loading && objects.length === 0 ? (
          <p className="py-8 text-center text-fine text-t3">Loading…</p>
        ) : visible.length === 0 ? (
          <EmptyState title="No images here" hint="Try another folder, flat view, or clear the filter." />
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {visible.map((o) => {
              const on = selected === o.key;
              const busy = resolving === o.key;
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(o.key)}
                    onDoubleClick={() => pick(o.key, multiple)}
                    aria-pressed={on}
                    aria-label={`Select ${baseName(o.key)}`}
                    title={`${o.key}${o.size ? ` · ${fmtSize(o.size)}` : ""}`}
                    className={`group relative block aspect-square w-full overflow-hidden rounded-xl bg-s0 ring-1 transition ${
                      on ? "ring-2 ring-accent" : "ring-line hover:ring-line2"
                    }`}
                  >
                    <img
                      src={cloudFileUrl(o.key)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-left text-micro text-white">
                      {baseName(o.key)}
                    </span>
                    {on && (
                      <span className="absolute right-1 top-1 rounded-full bg-accent p-1 text-white">
                        <Icon name="check" className="size-3" />
                      </span>
                    )}
                    {busy && (
                      <span className="absolute inset-0 grid place-items-center bg-black/50">
                        <Icon name="refresh" className="size-5 animate-spin text-white" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {cursor && (
          <button
            type="button"
            onClick={() => load(prefix, flat, cursor, true)}
            disabled={loading}
            className="btn btn-quiet gap-2"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
