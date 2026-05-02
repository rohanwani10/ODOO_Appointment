import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-sky-400 text-slate-950 hover:bg-sky-300",
  destructive: "bg-red-500 text-white hover:bg-red-400",
  outline: "border border-white/15 bg-transparent text-white hover:bg-white/10",
  secondary: "bg-white/10 text-white hover:bg-white/15",
  ghost: "bg-transparent text-white hover:bg-white/10",
  link: "bg-transparent text-sky-300 underline-offset-4 hover:underline",
};

const buttonSizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 py-2 text-sm",
  lg: "h-11 px-6 py-3",
  icon: "size-10",
  "icon-sm": "size-8",
  "icon-lg": "size-12",
};

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}) {
  const Comp = asChild ? "span" : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
