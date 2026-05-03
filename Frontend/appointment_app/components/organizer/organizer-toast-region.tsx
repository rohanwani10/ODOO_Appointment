"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export type OrganizerToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

type OrganizerToastRegionProps = {
  toasts: OrganizerToast[];
  onDismiss: (id: string) => void;
};

export function OrganizerToastRegion({
  toasts,
  onDismiss,
}: OrganizerToastRegionProps) {
  useEffect(() => {
    if (toasts.length === 0) {
      return undefined;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => onDismiss(toast.id), 3200),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onDismiss, toasts]);

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[100] flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-50"
                : "border-rose-400/20 bg-rose-500/12 text-rose-50"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            ) : (
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-300" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

