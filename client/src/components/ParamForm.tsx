import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { Badge, Tip } from "../ui/primitives";
import { uploadFileBlob } from "../api";
import { getParamType, isLoraParam, loraSlotCount, loraTokenIssues, prettyLabel, sliderBounds, sortParamEntries, TIER_B_LORA_PARAM, tierBLoraPayload } from "../params";
import R2Picker from "./R2Picker";
import { usePersistentState } from "../lib/hooks";
import type { ModelSchema, ParamSpec } from "../lib/types";
import type { TierBLora } from "../lib/models";

type Values = Record<string, unknown>;

const label = (name: string, spec: ParamSpec) => spec.title || prettyLabel(name, spec);

/* ------------------------------------------------------------------
   Image field — real uploads to the Worker's R2 bucket and returns a
   URL, because MuAPI fetches image params; a base64 data: URI is not
   what the API expects.
   ------------------------------------------------------------------ */
function ImageField({
  id,
  value,
  onSet,
  multiple,
  describedBy,
}: {
  id: string;
  value: unknown;
  onSet: (v: unknown) => void;
  multiple?: boolean;
  describedBy?: string;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [r2Open, setR2Open] = useState(false);
  const list = (Array.isArray(value) ? value : value ? [value] : []) as string[];

  const pickR2 = (url: string) => {
    if (multiple) onSet([...list, url]);
    else onSet(url);
  };

  async function upload(files: FileList | File[] | undefined) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    setBusy(true);
    setErr(null);
    try {
      const urls: string[] = [];
      for (const f of arr) {
        const res: any = await uploadFileBlob(f);
        urls.push(res.url || res.fileUrl || res.href || res.path || "");
      }
      const kept = urls.filter(Boolean);
      if (!kept.length) throw new Error("Upload returned no URL");
      onSet(multiple ? [...list, ...kept] : kept[0]);
    } catch (e) {
      setErr((e as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (list.length) {
    return (
      <div className="grid gap-2">
        <ul className="grid grid-cols-2 gap-2">
          {list.map((u, i) => (
            <li key={`${u}-${i}`} className="flex items-center gap-2 rounded-lg bg-s0 p-1.5 ring-1 ring-line">
              <img src={u} alt="" className="size-10 shrink-0 rounded object-cover" />
              <button
                type="button"
                onClick={() => onSet(list.filter((_, j) => j !== i))}
                className="btn btn-sm btn-quiet ml-auto"
                aria-label={`Remove image ${i + 1}`}
              >
                <Icon name="trash" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => onSet(multiple ? [] : undefined)} className="btn btn-sm btn-quiet gap-1.5">
          <Icon name="trash" className="size-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={() => setR2Open(true)}
          className="btn btn-sm btn-quiet gap-1.5"
        >
          <Icon name="image" className="size-3.5" />
          {multiple ? "Add from R2" : "Replace from R2"}
        </button>
        {r2Open && (
          <R2Picker open={r2Open} onClose={() => setR2Open(false)} multiple={multiple} onPick={pickR2} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files ?? undefined);
        }}
        className={`rounded-xl border border-dashed p-3 transition ${over ? "border-accent bg-accent/10" : "border-line2 bg-s0"}`}
      >
        <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 text-fine text-t2">
          <Icon name={busy ? "refresh" : "upload"} className="size-4" />
          <span>
            {busy ? "Uploading…" : multiple ? "Drop images or browse" : "Drop an image or "}
            {!busy && !multiple && <span className="font-medium text-accent-soft underline">browse</span>}
          </span>
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple={multiple}
          aria-describedby={describedBy}
          onChange={(e) => upload(e.target.files ?? undefined)}
          className="sr-only"
        />
      </div>
      <button
        type="button"
        onClick={() => setR2Open(true)}
        className="btn btn-sm btn-ghost mt-2 w-full justify-center gap-1.5"
      >
        <Icon name="image" className="size-3.5" />
        Pick from R2
      </button>
      {err && (
        <p className="mt-1.5 rounded-lg bg-crit/10 px-2.5 py-1.5 text-micro text-crit ring-1 ring-crit/25">{err}</p>
      )}
      {r2Open && (
        <R2Picker open={r2Open} onClose={() => setR2Open(false)} multiple={multiple} onPick={pickR2} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   LoRA field — one input per slot, count taken from the real schema
   description ("up to N") exactly as the previous picker did. Keeps the
   civitai:MODEL@VERSION and full-URL validation so a typo is caught
   before a paid run. Each filled slot gets its own strength slider
   (0-2, default 1): the provider takes {path, scale} objects and the
   scale used to be hardcoded to 1 with no way to change it.
   ------------------------------------------------------------------ */
type LoraSlot = { path: string; scale: number };

function toLoraSlots(value: unknown, slots: number): LoraSlot[] {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from({ length: slots }, (_, i) => {
    const el = arr[i] as any;
    if (el && typeof el === "object")
      return {
        path: String(el.path || el.url || ""),
        scale: typeof el.scale === "number" && isFinite(el.scale) ? el.scale : 1,
      };
    return { path: el ? String(el) : "", scale: 1 };
  });
}

function LoraField({
  id,
  name,
  spec,
  value,
  onSet,
}: {
  id: string;
  name: string;
  spec: ParamSpec;
  value: unknown;
  onSet: (v: unknown) => void;
}) {
  const slots = loraSlotCount(spec as any);
  const [drafts, setDrafts] = useState<LoraSlot[]>(() => toLoraSlots(value, slots));

  useEffect(() => {
    setDrafts((d) => {
      const fresh = toLoraSlots(value, slots);
      // A cleared value resets the rows; otherwise keep in-progress typing and
      // adopt committed scales/paths per slot.
      if (fresh.every((f) => !f.path)) return fresh;
      return fresh.map((f, i) => ({ path: d[i]?.path || f.path, scale: d[i]?.scale ?? f.scale }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, JSON.stringify(value)]);

  const commit = (next: LoraSlot[]) => {
    setDrafts(next);
    const kept = next
      .map((s) => ({ path: s.path.trim(), scale: s.scale }))
      .filter((s) => s.path);
    onSet(kept.length ? kept : undefined);
  };

  return (
    <div className="grid gap-2.5" id={id}>
      {drafts.map((slot, i) => {
        const issue = loraTokenIssues(slot.path);
        return (
          <div key={i} className="grid gap-1.5">
            <input
              type="text"
              value={slot.path}
              onChange={(e) => commit(drafts.map((d, j) => (j === i ? { ...d, path: e.target.value } : d)))}
              placeholder={i === 0 ? "civitai:MODEL@VERSION or https://…safetensors" : "empty"}
              aria-label={`${label(name, spec)} ${i + 1}`}
              aria-invalid={issue ? true : undefined}
              className={`field font-mono ${issue ? "ring-crit/50" : ""}`}
            />
            {issue && <p className="mt-1 text-micro text-crit">{issue}</p>}
            {slot.path.trim() && (
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-micro text-t3">Strength</span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={slot.scale}
                  onChange={(e) =>
                    commit(drafts.map((d, j) => (j === i ? { ...d, scale: Number(e.target.value) } : d)))
                  }
                  aria-label={`${label(name, spec)} ${i + 1} strength`}
                  className="h-9 min-w-0 flex-1 accent-[var(--color-accent)]"
                />
                <output className="tnum w-12 shrink-0 rounded-md bg-s0 py-1 text-center text-micro font-medium text-t1 ring-1 ring-line">
                  {Math.round(slot.scale * 100) / 100}
                </output>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ name, spec, value, onSet }: { name: string; spec: ParamSpec; value: unknown; onSet: (v: unknown) => void }) {
  const id = useId();
  const descId = `${id}-d`;
  const text = label(name, spec);
  const kind = getParamType(name, spec as any);
  const describedBy = spec.description ? descId : undefined;

  const control = () => {
    if (isLoraParam(name, spec as any)) return <LoraField id={id} name={name} spec={spec} value={value} onSet={onSet} />;
    if (kind === "image") return <ImageField id={id} value={value} onSet={onSet} describedBy={describedBy} />;
    if (kind === "image_array")
      return <ImageField id={id} value={value} onSet={onSet} multiple describedBy={describedBy} />;
    if (kind === "select") {
      const opts = spec.options || spec.enum || [];
      return (
        <select
          id={id}
          aria-describedby={describedBy}
          value={String(value ?? spec.default ?? "")}
          onChange={(e) => onSet(e.target.value || undefined)}
          className="field"
        >
          {!spec.required && <option value="">Not set</option>}
          {opts.map((o) => (
            <option key={String(o)} value={String(o)}>
              {String(o)}
            </option>
          ))}
        </select>
      );
    }
    if (kind === "boolean") {
      const on = Boolean(value ?? spec.default);
      return (
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={on}
          aria-describedby={describedBy}
          onClick={() => onSet(!on)}
          className={`btn w-full justify-between ${on ? "bg-accent/15 text-accent-soft ring-1 ring-accent/35" : "btn-ghost"}`}
        >
          {on ? "Enabled" : "Disabled"}
          <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-accent" : "bg-s3"}`} aria-hidden="true">
            <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[1.1rem]" : "left-0.5"}`} />
          </span>
        </button>
      );
    }
    if (kind === "range") {
      const b = sliderBounds(name, spec as any);
      const lo = b?.min ?? spec.min ?? 0;
      const hi = b?.max ?? spec.max ?? 1;
      const v = Number(value ?? spec.default ?? lo);
      return (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            min={lo}
            max={hi}
            step={b?.step ?? spec.step ?? 1}
            value={v}
            aria-describedby={describedBy}
            onChange={(e) => onSet(Number(e.target.value))}
            className="h-11 min-w-0 flex-1 accent-[var(--color-accent)]"
          />
          <output htmlFor={id} className="tnum w-14 shrink-0 rounded-md bg-s0 py-1.5 text-center text-fine font-medium text-t1 ring-1 ring-line">
            {v}
          </output>
        </div>
      );
    }
    if (kind === "number") {
      return (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={spec.min}
          max={spec.max}
          placeholder="Random"
          aria-describedby={describedBy}
          value={value == null ? "" : String(value)}
          onChange={(e) => onSet(e.target.value === "" ? undefined : Number(e.target.value))}
          className="field tnum"
        />
      );
    }
    return (
      <input
        id={id}
        type="text"
        placeholder={`Optional ${text.toLowerCase()}`}
        aria-describedby={describedBy}
        value={String(value ?? "")}
        onChange={(e) => onSet(e.target.value || undefined)}
        className="field"
      />
    );
  };

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5">
        <label htmlFor={id} className="text-fine font-medium capitalize text-t1">
          {text}
        </label>
        {spec.required && <Badge tone="crit">Required</Badge>}
        {spec.description && (
          <span className="@min-[30rem]/form:hidden">
            <Tip text={spec.description} label={`About ${text}`} />
          </span>
        )}
      </div>
      {control()}
      {spec.description && (
        <p id={descId} className="mt-1.5 hidden text-micro leading-relaxed text-t3 @min-[30rem]/form:block">
          {spec.description}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Tier B — the UNVERIFIED adapter slot.

   Rendered only for a model whose architecture is a candidate but whose own
   schema declares no adapter param (see lib/models.ts). Off by default, and
   the value only enters `values` while the box is ticked, so the request
   payload can never carry an `extra_lora` the user did not explicitly ask for.
   ------------------------------------------------------------------ */
function TierBLoraField({
  tierB,
  optIn,
  token,
  onChange,
}: {
  tierB: TierBLora;
  optIn: boolean;
  token: string;
  onChange: (next: { optIn: boolean; token: string }) => void;
}) {
  const id = useId();
  const issue = optIn ? loraTokenIssues(token) : null;
  return (
    <div className="@container/form col-span-full rounded-xl bg-warn/5 p-3 ring-1 ring-warn/25" id={id}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warn">
          <Icon name="warn" className="size-3" />
          Unverified
        </Badge>
        <label htmlFor={`${id}-opt`} className="text-fine font-medium text-t1">
          Send <span className="font-mono">{TIER_B_LORA_PARAM}</span> to this model anyway
        </label>
        <button
          type="button"
          id={`${id}-opt`}
          role="switch"
          aria-checked={optIn}
          onClick={() => onChange({ optIn: !optIn, token })}
          className={`btn btn-sm ml-auto gap-1.5 ${optIn ? "bg-warn/15 text-warn ring-1 ring-warn/35" : "btn-ghost"}`}
        >
          {optIn ? "Will be sent" : "Not sent"}
          <span className="relative h-5 w-9 rounded-full transition" aria-hidden="true">
            <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${optIn ? "left-[1.1rem]" : "left-0.5"}`} />
          </span>
        </button>
      </div>
      <p className="mt-1.5 text-micro leading-relaxed text-t3">
        {tierB.reason} This model&apos;s schema does not declare the field, so WaveSpeed may reject the whole
        request. Nothing is sent until you switch this on.
      </p>
      {optIn && (
        <div className="mt-2.5">
          <input
            type="text"
            value={token}
            onChange={(e) => onChange({ optIn: true, token: e.target.value })}
            placeholder="https://…safetensors"
            aria-label={`${TIER_B_LORA_PARAM} value`}
            aria-invalid={issue ? true : undefined}
            className={`field font-mono ${issue ? "ring-crit/50" : ""}`}
          />
          {issue && <p className="mt-1 text-micro text-crit">{issue}</p>}
        </div>
      )}
    </div>
  );
}

export default function ParamForm({
  schema,
  values,
  onChange,
  tierB = null,
}: {
  schema: ModelSchema | null;
  values: Values;
  onChange: (fn: (v: Values) => Values) => void;
  tierB?: TierBLora | null;
}) {
  const set = (name: string, v: unknown) =>
    onChange((prev) => {
      const next = { ...prev };
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) delete next[name];
      else next[name] = v;
      return next;
    });

  /* The opt-in is component state, not schema state, so it resets whenever the
     schema changes — i.e. whenever the user picks a different model. The
     token (a LoRA reference, not a secret) persists per device so a working
     value survives model-hopping; nothing is sent until the box is ticked. */
  const [tierBOptIn, setTierBOptIn] = useState(false);
  const [tierBToken, setTierBToken] = usePersistentState<string>("wavespeed_tierb_token", "");
  useEffect(() => setTierBOptIn(false), [schema]);

  /* tierBLoraPayload is the gate: an unticked box yields `{}`, so `set` is
     called with undefined and the key is removed from `values`. */
  const commitTierB = (next: { optIn: boolean; token: string }) => {
    setTierBOptIn(next.optIn);
    setTierBToken(next.token);
    set(TIER_B_LORA_PARAM, tierBLoraPayload(next)[TIER_B_LORA_PARAM]);
  };

  /* Sort with the real ranking helper: required first, then images, selects,
     numbers, booleans, strings. `prompt` is excluded — it has its own surface. */
  const entries = useMemo(() => {
    const all = Object.entries(schema?.params ?? {}).filter(([n]) => n !== "prompt");
    return sortParamEntries(all) as [string, ParamSpec][];
  }, [schema]);

  if (!schema) return null;
  if (!entries.length && !tierB) return <p className="text-fine text-t3">This model takes a prompt and nothing else.</p>;

  return (
    <div className="@container/form">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 @min-[30rem]/form:grid-cols-2 @min-[56rem]/form:grid-cols-3">
        {entries.map(([name, spec]) => (
          <Field key={name} name={name} spec={spec} value={values[name]} onSet={(v) => set(name, v)} />
        ))}
        {tierB && (
          <TierBLoraField tierB={tierB} optIn={tierBOptIn} token={tierBToken} onChange={commitTierB} />
        )}
      </div>
    </div>
  );
}