"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestimonialsCarouselProps {
  trustedTeams: number;
}

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  logo: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We replaced three tools and a shared spreadsheet. The result was a cleaner booking flow and fewer back-and-forth emails within the first week.",
    name: "Maya Torres",
    role: "Operations Lead",
    company: "Northwind Studio",
    logo: "/vercel.svg",
  },
  {
    quote:
      "The Google Calendar sync is the difference-maker. Availability stays accurate and our consultants stop worrying about double bookings.",
    name: "Daniel Kim",
    role: "Founder",
    company: "Signal Advisory",
    logo: "/next.svg",
  },
  {
    quote:
      "The landing page feels premium enough to send directly to prospects. It converts because the product is obvious before the first click.",
    name: "Elena Morris",
    role: "Growth Director",
    company: "Atlas Health",
    logo: "/globe.svg",
  },
];

export function TestimonialsCarousel({ trustedTeams }: TestimonialsCarouselProps) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % testimonials.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const activeTestimonial = useMemo(() => testimonials[index], [index]);

  const goToPrevious = () => {
    setIndex((current) => (current - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setIndex((current) => (current + 1) % testimonials.length);
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className="glass-premium relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.1),transparent_40%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-300">
              <Sparkles className="size-3.5 text-sky-300" />
              Trusted by {trustedTeams.toLocaleString()} teams
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Real teams use Calvero to keep scheduling calm and conversion-ready.
            </h3>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={goToPrevious}
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-all hover:bg-white/10"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={goToNext}
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-all hover:bg-white/10"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="relative mt-6 min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.article
              key={activeTestimonial.name}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
              className="grid gap-6 rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur md:grid-cols-[1fr_auto] md:items-center md:p-8"
            >
              <div>
                <Quote className="size-7 text-sky-300" />
                <p className="mt-4 text-lg leading-8 text-slate-100 sm:text-xl">
                  {activeTestimonial.quote}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Image
                      src={activeTestimonial.logo}
                      alt={`${activeTestimonial.company} logo`}
                      width={24}
                      height={24}
                      className="size-6"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {activeTestimonial.name}
                    </p>
                    <p className="text-sm text-slate-400">
                      {activeTestimonial.role} · {activeTestimonial.company}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200 sm:min-w-[16rem]">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span>Onboarding</span>
                  <span className="font-semibold text-emerald-300">2 days</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span>Booking friction</span>
                  <span className="font-semibold text-sky-300">Down 67%</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span>Calendar sync</span>
                  <span className="font-semibold text-white">Live</span>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {testimonials.map((testimonial, testimonialIndex) => (
            <button
              key={testimonial.name}
              type="button"
              aria-label={`Show testimonial from ${testimonial.name}`}
              onClick={() => setIndex(testimonialIndex)}
              className={cn(
                "h-2.5 rounded-full transition-all",
                testimonialIndex === index
                  ? "w-8 bg-sky-300"
                  : "w-2.5 bg-white/25 hover:bg-white/40",
              )}
            />
          ))}
        </div>
      </section>
    </MotionConfig>
  );
}
