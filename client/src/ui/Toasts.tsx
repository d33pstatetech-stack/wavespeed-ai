import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

export type ToastKind = "info" | "success" | "error" | "undo";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  detail?: string;
  onUndo?: () => void;
}

interface Ctx {
  toast: (message: string, kind?: ToastKind, detail?: string) => string;
  /** Optimistic destructive action with a real undo window — replaces window.confirm(). */
  toastUndo: (message: string, onCommit: () => void, onUndo: () => void, ms?: number) => void;
  dismiss: (id: string) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside provider");
  return c;
}

const STYLE: Record<ToastKind, { ring: string; icon: string; tone: string }> = {
  info: { ring: "ring-line2", icon: "info", tone: "text-info" },
  success: { ring: "ring-pass/35", icon: "check", tone: "text-pass" },
  error: { ring: "ring-crit/45", icon: "warn", tone: "text-crit" },
  undo: { ring: "ring-line2", icon: "trash", tone: "text-t2" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((t) => t.filter((x) => x.id !== id));
    const h = timers.current.get(id);
    if (h) {
      clearTimeout(h);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info", detail?: string) => {
      const id = Math.random().toString(36).slice(2);
      // Cap the stack so a burst of failures cannot build a wall.
      setItems((t) => [...t.slice(-3), { id, kind, message, detail }]);
      // Errors persist until dismissed — they carry information the user needs.
      if (kind !== "error") {
        timers.current.set(id, window.setTimeout(() => dismiss(id), 4800));
      }
      return id;
    },
    [dismiss],
  );

  const toastUndo = useCallback(
    (message: string, onCommit: () => void, onUndo: () => void, ms = 6000) => {
      const id = Math.random().toString(36).slice(2);
      let undone = false;
      setItems((t) => [
        ...t.slice(-3),
        {
          id,
          kind: "undo",
          message,
          onUndo: () => {
            undone = true;
            onUndo();
            dismiss(id);
          },
        },
      ]);
      timers.current.set(
        id,
        window.setTimeout(() => {
          if (!undone) onCommit();
          dismiss(id);
        }, ms),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, toastUndo, dismiss }), [toast, toastUndo, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* Announced to assistive tech — the original app had no live region at all. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-end sm:p-4"
      >
        {items.map((t) => {
          const s = STYLE[t.kind];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-[26rem] items-start gap-2.5 rounded-xl bg-s2 px-3 py-2.5 shadow-e3 ring-1 ${s.ring}`}
              style={{ animation: "rise .22s cubic-bezier(.2,.9,.3,1)" }}
            >
              <Icon name={s.icon} className={`mt-0.5 ${s.tone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-fine font-medium text-t1">{t.message}</p>
                {t.detail && <p className="mt-0.5 break-words text-micro text-t3">{t.detail}</p>}
              </div>
              {t.onUndo && (
                <button type="button" onClick={t.onUndo} className="btn btn-sm btn-ghost gap-1.5">
                  <Icon name="undo" className="size-[0.9rem]" />
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="hit -m-1 grid size-7 shrink-0 place-items-center rounded-md text-t3 hover:bg-s3 hover:text-t1"
              >
                <Icon name="close" className="size-[0.9rem]" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
