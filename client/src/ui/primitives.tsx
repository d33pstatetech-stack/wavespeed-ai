import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { autoBullets } from "../tip-format";
import type { Tier } from "../lib/types";

/* ------------------------------------------------------------------
   TierBadge — glyph + text + colour. Never colour alone (WCAG 1.4.1),
   and never a title attribute (invisible on touch).
   ------------------------------------------------------------------ */
const TIER = {
  verified: { label: "Verified", glyph: "✓", cls: "text-pass bg-pass/12 ring-pass/30" },
  likely: { label: "Likely", glyph: "~", cls: "text-warn bg-warn/12 ring-warn/30" },
  unsupported: { label: "Unsupported", glyph: "✕", cls: "text-crit bg-crit/12 ring-crit/30" },
} as const;

export function TierBadge({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const t = TIER[tier];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-semibold leading-none ring-1 ${t.cls}`}
    >
      <span aria-hidden="true">{t.glyph}</span>
      {!compact && t.label}
      <span className="sr-only">
        {t.label} compatibility with the pinned adapters
      </span>
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "pass" | "warn" | "crit" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "text-t3 bg-s3 ring-line2",
    accent: "text-accent-soft bg-accent/12 ring-accent/30",
    pass: "text-pass bg-pass/12 ring-pass/30",
    warn: "text-warn bg-warn/12 ring-warn/30",
    crit: "text-crit bg-crit/12 ring-crit/30",
    info: "text-info bg-info/12 ring-info/30",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-medium leading-none ring-1 ${tones} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="progressbar"
      aria-label="Working"
      className={`inline-block size-4 shrink-0 rounded-full border-2 border-current/25 border-t-current ${className}`}
      style={{ animation: "spin .7s linear infinite" }}
    />
  );
}

/* ------------------------------------------------------------------
   Tip — native Popover API: top layer, light-dismiss and Escape for
   free. Replaces the hand-rolled viewport clamping + the hover/tap
   race in the original Tip.jsx. Hover only on fine pointers.
   ------------------------------------------------------------------ */
export function Tip({ text, label = "More information" }: { text: string; label?: string }) {
  const id = useId().replace(/:/g, "_");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    const p = popRef.current?.getBoundingClientRect();
    if (!b || !p) return;
    const pad = 12;
    let left = b.left + b.width / 2 - p.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - p.width - pad));
    let top = b.top - p.height - 8;
    if (top < pad) top = b.bottom + 8;
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") place();
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  /* Provider schema descriptions are multi-statement prose. autoBullets turns
     them into an intro plus a list so they stay scannable in a narrow popover;
     it returns null for plain one-liners, which render as a paragraph. */
  const shaped = useMemo(() => autoBullets(text), [text]);

  const open = () => {
    try {
      if (!popRef.current?.matches(":popover-open")) popRef.current?.showPopover();
    } catch {
      /* unsupported */
    }
  };
  const close = () => {
    try {
      if (popRef.current?.matches(":popover-open")) popRef.current?.hidePopover();
    } catch {
      /* unsupported */
    }
  };
  const toggle = () => (popRef.current?.matches(":popover-open") ? close() : open());

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={undefined}
        onClick={toggle}
        onPointerEnter={(e) => e.pointerType === "mouse" && open()}
        onPointerLeave={(e) => e.pointerType === "mouse" && close()}
        // Keyboard focus opens it; a pointer tap is handled by onClick only,
        // so touch never races the open/close the way the original did.
        onFocus={(e) => e.target.matches(":focus-visible") && open()}
        onBlur={close}
        className="hit inline-grid size-6 shrink-0 place-items-center rounded-full text-t3 transition hover:bg-s3 hover:text-accent-soft"
      >
        <Icon name="info" className="size-[0.95rem]" />
      </button>
      <div
        ref={popRef}
        id={id}
        popover="auto"
        role="tooltip"
        className="fixed z-[90] max-w-[min(34ch,calc(100vw-1.5rem))] rounded-xl bg-s2 px-3 py-2.5 text-fine leading-relaxed text-t1 shadow-e3 ring-1 ring-line2"
        style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
      >
        {shaped ? (
          <>
            {shaped.intro && <p className="mb-1.5">{shaped.intro}</p>}
            <ul className="grid gap-1">
              {shaped.bullets.map((b, i) => (
                <li key={i} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-t3">
                    •
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          text
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------
   Dialog — <dialog> element: focus trap, Escape and inertness are
   handled by the platform. Sized with dvh so the footer is never
   trapped under mobile browser chrome.
   ------------------------------------------------------------------ */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`panel-overlay m-0 w-full max-w-none p-0 text-t2 backdrop:bg-black/70
        fixed bottom-0 left-0 top-auto max-h-[90dvh] rounded-b-none
        sm:inset-0 sm:m-auto sm:max-h-[min(86dvh,52rem)] sm:rounded-2xl
        ${size === "lg" ? "sm:w-[min(68rem,calc(100vw-3rem))]" : "sm:w-[min(40rem,calc(100vw-3rem))]"}`}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lede font-semibold text-t1">
              {title}
            </h2>
            {description && <p className="mt-1 text-fine text-t3">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="btn btn-icon btn-quiet -mr-2">
            <Icon name="close" />
          </button>
        </header>
        <div className="scroll-y min-h-0 flex-1 px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <footer className="dock-pad flex flex-wrap items-center justify-end gap-2 border-t border-line bg-s2 px-4 pt-3 sm:px-5 sm:pb-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------
   SegmentedControl — real radio semantics, 44px targets.
   ------------------------------------------------------------------ */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-1 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`btn btn-sm min-h-9 gap-1.5 ${
              on ? "bg-accent/18 text-accent-soft ring-1 ring-accent/40" : "text-t3 hover:bg-s2 hover:text-t1"
            }`}
          >
            {o.icon && <Icon name={o.icon} className="size-[0.95rem]" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon = "search",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-s2 text-t3 ring-1 ring-line">
        <Icon name={icon} />
      </span>
      <p className="text-body font-medium text-t1">{title}</p>
      {hint && <p className="max-w-[40ch] text-fine text-t3">{hint}</p>}
      {action}
    </div>
  );
}
