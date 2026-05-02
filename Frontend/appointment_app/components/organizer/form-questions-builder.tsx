"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EditableQuestion,
  getQuestionBadgeLabel,
  serviceQuestionTypeOptions,
} from "@/lib/organizer-services";

type QuestionDraft = {
  client_id?: string;
  question_text: string;
  field_type: EditableQuestion["field_type"];
  is_required: boolean;
  options: string[];
  presentation: EditableQuestion["presentation"];
};

type FormQuestionsBuilderProps = {
  questions: EditableQuestion[];
  onChange: (questions: EditableQuestion[]) => void;
};

const defaultQuestionDraft: QuestionDraft = {
  question_text: "",
  field_type: "TEXT",
  is_required: true,
  options: [],
  presentation: "DROPDOWN",
};

export function FormQuestionsBuilder({
  questions,
  onChange,
}: FormQuestionsBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(defaultQuestionDraft);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [optionInput, setOptionInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDialogOpen) {
      setDraft(defaultQuestionDraft);
      setEditingClientId(null);
      setOptionInput("");
      setError(null);
    }
  }, [isDialogOpen]);

  const order = useMemo(() => questions.map((question) => question.client_id), [questions]);

  function openCreateModal() {
    setDraft(defaultQuestionDraft);
    setEditingClientId(null);
    setIsDialogOpen(true);
  }

  function openEditModal(question: EditableQuestion) {
    setDraft({
      client_id: question.client_id,
      question_text: question.question_text,
      field_type: question.field_type,
      is_required: question.is_required,
      options: [...question.options],
      presentation: question.presentation,
    });
    setEditingClientId(question.client_id);
    setIsDialogOpen(true);
  }

  function handleReorder(nextOrder: string[]) {
    const byId = new Map(questions.map((question) => [question.client_id, question]));
    onChange(nextOrder.map((clientId) => byId.get(clientId)).filter(Boolean) as EditableQuestion[]);
  }

  function handleDelete(clientId: string) {
    onChange(questions.filter((question) => question.client_id !== clientId));
  }

  function addOption() {
    const nextOption = optionInput.trim();
    if (!nextOption) {
      return;
    }

    setDraft((current) => ({
      ...current,
      options: [...current.options, nextOption],
    }));
    setOptionInput("");
  }

  function removeOption(optionIndex: number) {
    setDraft((current) => ({
      ...current,
      options: current.options.filter((_, index) => index !== optionIndex),
    }));
  }

  function handleSaveQuestion() {
    const trimmedQuestion = draft.question_text.trim();
    const sanitizedOptions = draft.options.map((option) => option.trim()).filter(Boolean);

    if (!trimmedQuestion) {
      setError("Question text is required.");
      return;
    }

    if (draft.field_type === "SELECT" && sanitizedOptions.length < 2) {
      setError("Add at least two options for a choice-based question.");
      return;
    }

    const nextQuestion: EditableQuestion = {
      client_id:
        editingClientId ??
        `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id: questions.find((question) => question.client_id === editingClientId)?.id,
      question_text: trimmedQuestion,
      field_type: draft.field_type,
      is_required: draft.is_required,
      options: draft.field_type === "SELECT" ? sanitizedOptions : [],
      presentation: draft.field_type === "SELECT" ? draft.presentation : "DROPDOWN",
    };

    if (editingClientId) {
      onChange(
        questions.map((question) =>
          question.client_id === editingClientId ? nextQuestion : question,
        ),
      );
    } else {
      onChange([...questions, nextQuestion]);
    }

    setIsDialogOpen(false);
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-white">Custom booking questions</p>
          <p className="text-sm text-slate-400">
            {questions.length === 0
              ? "Add intake questions before customers book."
              : `${questions.length} question${questions.length === 1 ? "" : "s"} configured`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            {questions.length}
          </span>
          {isExpanded ? (
            <ChevronUp className="size-5 text-slate-400" />
          ) : (
            <ChevronDown className="size-5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                  Drag questions into the booking order you want customers to see.
                </p>
                <Button type="button" onClick={openCreateModal}>
                  <Plus className="size-4" />
                  Add question
                </Button>
              </div>

              {questions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
                  No questions yet. Add one to collect booking details up front.
                </div>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={order}
                  onReorder={handleReorder}
                  className="space-y-3"
                >
                  {questions.map((question, index) => (
                    <Reorder.Item key={question.client_id} value={question.client_id}>
                      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 cursor-grab rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 active:cursor-grabbing"
                            aria-label={`Reorder question ${index + 1}`}
                          >
                            <GripVertical className="size-4" />
                          </button>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">
                                {question.question_text}
                              </p>
                              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-200">
                                {getQuestionBadgeLabel(question)}
                              </span>
                              {question.is_required ? (
                                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-rose-200">
                                  Required
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-slate-400">
                              {question.field_type === "SELECT"
                                ? `${question.options.length} option${question.options.length === 1 ? "" : "s"}`
                                : `Position ${index + 1}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openEditModal(question)}
                            className="border-white/15"
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDelete(question.client_id)}
                            className="border-rose-400/20 text-rose-200 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[32px] border-white/10 bg-slate-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editingClientId ? "Edit question" : "Add booking question"}
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Configure the information customers must provide during booking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="question-field-type">Question type</Label>
              <Select
                value={draft.field_type}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    field_type: value as EditableQuestion["field_type"],
                    options: value === "SELECT" ? current.options : [],
                    presentation: value === "SELECT" ? current.presentation : "DROPDOWN",
                  }))
                }
              >
                <SelectTrigger
                  id="question-field-type"
                  className="h-11 w-full rounded-2xl border-white/10 bg-slate-950/70 text-white"
                >
                  <SelectValue placeholder="Select a question type" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-950 text-white">
                  {serviceQuestionTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-text">Question text</Label>
              <Textarea
                id="question-text"
                value={draft.question_text}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    question_text: event.target.value,
                  }))
                }
                placeholder="What should customers answer?"
                className="min-h-24 rounded-2xl border-white/10 bg-slate-950/70"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white">
              <Checkbox
                checked={draft.is_required}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, is_required: checked === true }))
                }
                className="border-white/20"
              />
              Required for booking
            </label>

            <AnimatePresence initial={false}>
              {draft.field_type === "SELECT" ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="question-presentation">Display style</Label>
                    <Select
                      value={draft.presentation}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          presentation: value as EditableQuestion["presentation"],
                        }))
                      }
                    >
                      <SelectTrigger
                        id="question-presentation"
                        className="h-11 w-full rounded-2xl border-white/10 bg-slate-950/70 text-white"
                      >
                        <SelectValue placeholder="Display style" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-950 text-white">
                        <SelectItem value="RADIO">Multiple Choice</SelectItem>
                        <SelectItem value="DROPDOWN">Dropdown / Select</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="question-option-input">Options</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="question-option-input"
                        value={optionInput}
                        onChange={(event) => setOptionInput(event.target.value)}
                        placeholder="Add an option"
                        className="border-white/10 bg-slate-950/70"
                      />
                      <Button type="button" variant="secondary" onClick={addOption}>
                        Add option
                      </Button>
                    </div>

                    {draft.options.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Add at least two choices for this question.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {draft.options.map((option, index) => (
                          <span
                            key={`${option}-${index}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-sm text-white"
                          >
                            {option}
                            <button
                              type="button"
                              aria-label={`Remove option ${option}`}
                              onClick={() => removeOption(index)}
                              className="rounded-full text-slate-400 transition-colors hover:text-white"
                            >
                              <X className="size-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? (
              <p className="text-sm text-rose-300" aria-live="polite">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveQuestion}>
              {editingClientId ? "Save question" : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

