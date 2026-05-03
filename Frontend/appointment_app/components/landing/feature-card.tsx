import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  href?: string;
  ctaLabel?: string;
  className?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  badge,
  href,
  ctaLabel = "Learn more",
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "glass-premium group relative overflow-hidden border-white/10 bg-white/[0.04] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-[0_24px_80px_rgba(2,6,23,0.35)]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardHeader className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/8 text-sky-300 transition-transform duration-300 group-hover:scale-105">
            <Icon className="size-6" />
          </div>
          {badge ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-300">
              {badge}
            </span>
          ) : null}
        </div>
        <CardTitle className="text-xl text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-5">
        <CardDescription className="text-sm leading-7 text-slate-400">
          {description}
        </CardDescription>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition-colors hover:text-sky-200"
          >
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
