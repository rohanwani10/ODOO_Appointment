"use client";

import { useState, useTransition } from "react";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackFormProps {
  maxLength?: number;
}

export function FeedbackForm({ maxLength = 2000 }: FeedbackFormProps) {
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!content.trim()) return;

    startTransition(async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Here you would call: await submitFeedback(content);
      setSubmitted(true);
      setContent("");

      // Keep success state visible for 4 seconds
      setTimeout(() => {
        setSubmitted(false);
      }, 4000);
    });
  };

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;

  // Success State
  if (submitted) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94)),radial-gradient(circle_at_top_right,rgba(34,197,94,0.1),transparent_30%)] p-8 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30">
              <CheckCircle2 className="size-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Thank you!</h2>
            <p className="mt-3 text-base text-slate-300">
              We've received your feedback and really appreciate it.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Your input helps us make MeetMint better.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Form State
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%)] p-8 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-sky-500/15 border border-sky-400/20">
            <MessageSquare className="size-6 text-sky-300" />
          </div>
          <h1 className="text-3xl font-bold text-white">Feature Feedback</h1>
          <p className="mt-3 text-slate-300">
            What features would make MeetMint work better for you?
          </p>
        </div>

        {/* Textarea */}
        <div className="space-y-3 mb-6">
          <Textarea
            placeholder="Tell us your thoughts... (e.g., 'It would be great if I could...')"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
            rows={6}
            className="resize-none rounded-lg border border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-colors"
          />
          <div className="flex justify-between items-center px-1">
            <span className="text-xs text-slate-400">
              Be specific and constructive
            </span>
            <span
              className={`text-xs font-medium ${
                isOverLimit
                  ? "text-red-400"
                  : charCount > maxLength * 0.8
                    ? "text-amber-400"
                    : "text-slate-400"
              }`}
            >
              {charCount}/{maxLength}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isPending || !content.trim() || isOverLimit}
          className="w-full py-6 text-base font-semibold rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
              Submitting feedback...
            </span>
          ) : (
            "Submit Feedback"
          )}
        </Button>

        {/* Helper Text */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Your feedback is valuable and helps shape the future of MeetMint.
        </p>
      </div>
    </div>
  );
}
