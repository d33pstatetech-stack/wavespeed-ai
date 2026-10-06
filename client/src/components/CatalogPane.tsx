import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, EmptyState, ModelName, Segmented, TierBadge } from "../ui/primitives";
import { useDebounced, useVirtualRows } from "../lib/hooks";
import { tierFor } from "../lib/tiers";
import type { Group, Lora, Model } from "../lib/types";

const ROW = 60;

const GROUPS: { value: Group | "all"; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "grid" },
  { value: "image", label: "Image", icon: "image" },
  { value: "video", label: "Video", icon: "video" },
  { value: "audio", label: "Audio", icon: "audio" },
  { value: "text", label: "Text", icon: "text" },
  { value: "3d", label: "3D", icon: "cube" },
];

export default function CatalogPane({
  models,
  selectedId,
  onSelect,
  pinnedLoras,
  onClearPins,
}: {
  models: Model[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pinnedLoras: Lora[];
  onClearPins: () => void;
}) {
  const [group, setGroup] = useState<Group | "all">("all");
  const [raw, setRaw] = useState("");
  const [sort, setSort] = useState<"popular" | "name" | "cost">("popular");
  const [showIncompatible, setShowIncompatible] = useState(false);
  const [active, setActive] = useState(0);

  const query = useDebounced(raw, 120);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId().replace(/:/g, "_");
  const pinning = pinnedLoras.length > 0;

  const tiers = useMemo(() => {
    const m = new Map<string, ReturnType<typeof tierFor>>();
    if (!pinning) return m;
    for (const mo of models) m.set(mo.id, tierFor(mo, pinnedLoras));
    return m;
  }, [models, pinnedLoras, pinning]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = group === "all" ? models : models.filter((m) => m.group === group);
    if (q) {
      list = list.filter(
        (m) =>
          m.id.includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.family.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q),
      );
    }
    if (pinning && !showIncompatible) {
      list = list.filter((m) => tiers.get(m.id) !== "unsupported");
    }
    const out = [...list];
    if (sort === "popular") out.sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
    else if (sort === "cost") out.sort((a, b) => a.cost - b.cost);
    else out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [models, group, query, sort, pinning, showIncompatible, tiers]);

  const v = useVirtualRows({ count: rows.length, rowHeight: ROW, ref: listRef });

  useEffect(() => {
    setActive(0);
  }, [query, group, sort, showIncompatible]);

  // Only follow the ACTIVE row when it changes — never yank the list back
  // while the user is scrolling it by hand.
  const scrollToIndex = v.scrollToIndex;
  useEffect(() => {
    scrollToIndex(active);
  }, [active, scrollToIndex]);

  const commit = useCallback(
    (i: number) => {
      const m = rows[i];
      if (m) onSelect(m.id);
    },
    [rows, onSelect],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 8, rows.length - 1));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 8, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(rows.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(active);
    } else if (e.key === "Escape" && raw) {
      e.preventDefault();
      setRaw("");
    }
  };

  const visible = rows.slice(v.start, v.end);

  return (
    <section
      aria-label="Model catalogue"
      className="panel flex min-h-0 flex-col overflow-hidden"
    >
      <div className="flex flex-col gap-2.5 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-fine font-semibold uppercase tracking-[0.1em] text-t3">Catalogue</h2>
          <Badge tone="neutral" className="tnum">
            {rows.length.toLocaleString()} / {models.length.toLocaleString()}
          </Badge>
        </div>

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t3"
          />
          <input
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={rows.length ? `${listId}-opt-${active}` : undefined}
            aria-label={`Search ${models.length} models. Use arrow keys to browse, Enter to select.`}
            placeholder="Search models, families, categories…"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={onKeyDown}
            className="field pl-9"
          />
        </div>

        <Segmented value={group} onChange={setGroup} options={GROUPS} label="Filter by media type" />

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cat-sort" className="text-micro text-t3">
            Sort
          </label>
          <select
            id="cat-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="field min-h-9 w-auto flex-1 py-1 text-micro sm:flex-none"
          >
            <option value="popular">Most used</option>
            <option value="name">Name A–Z</option>
            <option value="cost">Cheapest first</option>
          </select>
        </div>

        {pinning && (
          <div className="rounded-lg bg-accent/10 p-2.5 ring-1 ring-accent/30">
            <div className="flex items-start gap-2">
              <Icon name="pin" className="mt-0.5 size-4 text-accent-soft" />
              <p className="min-w-0 flex-1 text-micro leading-relaxed text-t2">
                Filtered to adapters:{" "}
                <span className="font-medium text-t1">
                  {pinnedLoras.map((l) => l.name).join(" + ")}
                </span>
              </p>
              <button type="button" onClick={onClearPins} className="btn btn-sm btn-quiet">
                Clear
              </button>
            </div>
            <label className="mt-2 flex min-h-9 cursor-pointer items-center gap-2 text-micro text-t2">
              <input
                type="checkbox"
                checked={showIncompatible}
                onChange={(e) => setShowIncompatible(e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Show unsupported models
            </label>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No models match"
          hint="Try a different media type, or clear the search term."
          action={
            <button type="button" onClick={() => setRaw("")} className="btn btn-ghost btn-sm mt-1">
              Reset search
            </button>
          }
        />
      ) : (
        <div ref={listRef} className="scroll-y min-h-0 flex-1 p-1.5">
          <div
            id={listId}
            role="listbox"
            aria-label="Models"
            tabIndex={-1}
            style={{ height: v.totalHeight, position: "relative" }}
          >
            {visible.map((m, i) => {
              const index = v.start + i;
              const tier = tiers.get(m.id);
              return (
                <div
                  key={m.id}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={m.id === selectedId}
                  // Virtualised: only ~20 options exist in the DOM, so the
                  // real position in the 723-item set must be declared.
                  aria-posinset={index + 1}
                  aria-setsize={rows.length}
                  data-active={index === active}
                  onClick={() => {
                    setActive(index);
                    onSelect(m.id);
                  }}
                  className="row absolute inset-x-0 flex-col items-stretch justify-center gap-0.5 py-1.5"
                  style={{ top: index * ROW, height: ROW - 4 }}
                >
                  <div className="flex items-center gap-2">
                    {pinning && tier && <TierBadge tier={tier} compact />}
                    <ModelName name={m.name} className="min-w-0 flex-1 text-fine font-medium text-t1" />
                    <span className="tnum shrink-0 text-micro font-semibold text-t2">
                      {m.cost > 0 ? `$${m.cost.toFixed(3)}` : "Free"}
                      {m.dynamicPricing && <span aria-hidden="true">*</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-micro text-t3">
                    <Icon
                      name={
                        m.group === "image"
                          ? "image"
                          : m.group === "video"
                            ? "video"
                            : m.group === "audio"
                              ? "audio"
                              : m.group === "3d"
                                ? "cube"
                                : "text"
                      }
                      className="size-3.5"
                    />
                    <span className="truncate">{m.category}</span>
                    {m.runs > 0 && (
                      <span className="tnum ml-auto shrink-0">
                        {m.runs} run{m.runs === 1 ? "" : "s"}
                        {m.rating != null && (
                          <>
                            {" · "}
                            <span className="text-warn">★</span> {m.rating.toFixed(1)}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="border-t border-line px-3 py-2 text-micro text-t3">
        <kbd className="rounded bg-s3 px-1 py-0.5 font-mono text-[0.9em] text-t2">/</kbd> focus ·{" "}
        <kbd className="rounded bg-s3 px-1 py-0.5 font-mono text-[0.9em] text-t2">↑↓</kbd> browse ·{" "}
        <kbd className="rounded bg-s3 px-1 py-0.5 font-mono text-[0.9em] text-t2">↵</kbd> select ·{" "}
        <span className="tnum">
          {visible.length} of {rows.length.toLocaleString()} rows in the DOM
        </span>
      </p>
    </section>
  );
}
