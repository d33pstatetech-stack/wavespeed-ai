import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, Dialog, EmptyState, ModelName, Spinner } from "../ui/primitives";
import { useToast } from "../ui/Toasts";
import { useElapsed } from "../lib/hooks";
import type { Job, Model, Run } from "../lib/types";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Stars({ value, onRate }: { value?: number; onRate: (n: number) => void }) {
  return (
    <div role="group" aria-label="Rate this result" className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onRate(n)}
          aria-label={`Rate ${n} of 5`}
          aria-pressed={value === n}
          className={`hit grid size-7 place-items-center rounded transition ${
            (value ?? 0) >= n ? "text-warn" : "text-t3 hover:text-t2"
          }`}
        >
          <Icon name="star" className="size-4" strokeWidth={(value ?? 0) >= n ? 2.4 : 1.6} />
        </button>
      ))}
    </div>
  );
}

export default function ResultsPane({
  job,
  runs,
  models,
  onRate,
  onReuse,
  onClear,
}: {
  job: Job | null;
  runs: Run[];
  models: Model[];
  onRate: (id: string, n: number) => void;
  onReuse: (run: Run) => void;
  onClear: () => void;
}) {
  const { toast } = useToast();
  const [viewing, setViewing] = useState<{ run: Run; url: string } | null>(null);
  const elapsed = useElapsed(job?.status === "running", job?.startedAt ?? 0);

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const cells = useMemo(
    () =>
      runs.flatMap((r) =>
        r.outputs.map((url, i) => ({ run: r, url, key: `${r.id}-${i}` })),
      ),
    [runs],
  );

  return (
    <section aria-label="Results" className="panel flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line p-3">
        <h2 className="text-fine font-semibold uppercase tracking-[0.1em] text-t3">Results</h2>
        <Badge tone="neutral" className="tnum">
          {cells.length}
        </Badge>
        {runs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="btn btn-sm btn-quiet ml-auto gap-1.5"
          >
            <Icon name="trash" className="size-3.5" />
            Clear
          </button>
        )}
      </header>

      <div className="scroll-y min-h-0 flex-1 p-3">
        {/* ---- live job card ---- */}
        {job && job.status !== "idle" && (
          <div className="mb-3 rounded-xl bg-s2 p-3 ring-1 ring-accent/30">
            <div className="flex items-center gap-2">
              {job.status === "running" || job.status === "queued" ? (
                <Spinner className="text-accent-soft" />
              ) : (
                <Icon
                  name={job.status === "done" ? "check" : "warn"}
                  className={job.status === "done" ? "text-pass" : "text-crit"}
                />
              )}
              <ModelName
                name={byId.get(job.modelId)?.name ?? job.modelId}
                className="min-w-0 flex-1 text-fine font-medium text-t1"
              />
              <span className="tnum shrink-0 text-micro text-t3">
                {job.status === "running" ? fmt(elapsed) : fmt(job.elapsedMs)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-micro text-t3">{job.prompt}</p>
            {(job.status === "running" || job.status === "queued") && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-s0">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-info transition-[width] duration-200"
                  style={{ width: `${job.progress * 100}%` }}
                />
              </div>
            )}
            {job.status === "error" && (
              <p className="mt-2 rounded-lg bg-crit/10 px-2.5 py-2 text-micro text-crit ring-1 ring-crit/25">
                {job.error}
              </p>
            )}
          </div>
        )}

        {cells.length === 0 ? (
          <EmptyState
            icon="image"
            title="Nothing generated yet"
            hint="Completed runs land here with their cost, elapsed time and prompt attached."
          />
        ) : (
          /* auto-fill: no per-breakpoint column guessing */
          <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(7.5rem,100%),1fr))]">
            {cells.map(({ run, url, key }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setViewing({ run, url })}
                  className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-s0 ring-1 ring-line transition hover:ring-accent/50 focus-visible:ring-2 focus-visible:ring-info"
                >
                  {run.kind === "video" ? (
                    <video
                      src={url}
                      muted
                      loop
                      playsInline
                      preload="none"
                      aria-label={`Video for: ${run.prompt.slice(0, 80)}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <img
                      src={url}
                      alt={`Result for: ${run.prompt.slice(0, 80)}`}
                      width={300}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5 text-left text-micro text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Icon name="eye" className="size-3.5" />
                    <span className="tnum">${run.cost.toFixed(3)}</span>
                  </span>
                  {run.kind === "video" && (
                    <span className="absolute left-1.5 top-1.5 flex items-center rounded bg-black/70 px-1.5 py-0.5 text-white" aria-hidden="true">
                      <Icon name="play" className="size-3" />
                    </span>
                  )}
                  {run.rating != null && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-micro text-warn">
                      ★ {run.rating}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={byId.get(viewing?.run.modelId ?? "")?.name ?? "Result"}
        description={viewing ? `${fmt(viewing.run.elapsedMs)} · $${viewing.run.cost.toFixed(4)}` : undefined}
        size="lg"
        footer={
          viewing && (
            <>
              <Stars value={viewing.run.rating} onRate={(n) => onRate(viewing.run.id, n)} />
              <span className="flex-1" />
              <a href={viewing.url} download target="_blank" rel="noreferrer" className="btn btn-ghost gap-2">
                <Icon name="download" className="size-4" />
                Download
              </a>
              <button
                type="button"
                onClick={() => {
                  onReuse(viewing.run);
                  setViewing(null);
                  toast("Prompt and model restored", "success");
                }}
                className="btn btn-primary gap-2"
              >
                <Icon name="refresh" className="size-4" />
                Reuse settings
              </button>
            </>
          )
        }
      >
        {viewing && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            {viewing.run.kind === "video" ? (
              <video
                src={viewing.url}
                controls
                playsInline
                className="w-full rounded-xl bg-s0 ring-1 ring-line"
              />
            ) : (
              <img
                src={viewing.url}
                alt={viewing.run.prompt}
                className="w-full rounded-xl bg-s0 object-contain ring-1 ring-line"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-micro font-semibold uppercase tracking-[0.1em] text-t3">Prompt</h3>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-fine leading-relaxed text-t1">
                {viewing.run.prompt}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-micro">
                {[
                  ["Model", byId.get(viewing.run.modelId)?.name ?? viewing.run.modelId],
                  ["Cost", `$${viewing.run.cost.toFixed(4)}`],
                  ["Elapsed", fmt(viewing.run.elapsedMs)],
                  ["Created", new Date(viewing.run.at).toLocaleString()],
                ].map(([k, val]) => (
                  <div key={k} className="rounded-lg bg-s0 p-2 ring-1 ring-line">
                    <dt className="text-t3">{k}</dt>
                    <dd className="mt-0.5 break-words font-medium text-t1">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
