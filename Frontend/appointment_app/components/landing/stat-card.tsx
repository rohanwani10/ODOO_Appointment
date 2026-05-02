import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "sky" | "emerald" | "violet" | "amber";
  className?: string;
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, string> = {
  sky: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  violet: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  amber: "text-amber-300 bg-amber-400/10 border-amber-400/20",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "sky",
  className,
}: StatCardProps) {
  return (
    <article
      className={cn(
        "glass-premium group relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-400">
            {label}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {value}
          </p>
          <p className="mt-2 max-w-[20rem] text-sm leading-6 text-slate-400">
            {detail}
          </p>
        </div>
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl border text-white shadow-lg shadow-black/10",
            toneStyles[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </article>
  );
}
