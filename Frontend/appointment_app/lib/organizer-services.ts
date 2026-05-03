import type {
  FormQuestion,
  Service,
  ServiceAssignmentType,
  ServiceResourceAssignment,
} from "@/types/service";

export type QuestionPresentation = "RADIO" | "DROPDOWN";

export type EditableQuestion = {
  client_id: string;
  id?: number;
  question_text: string;
  field_type: FormQuestion["field_type"];
  is_required: boolean;
  options: string[];
  presentation: QuestionPresentation;
};

export type EditableServiceAssignment = {
  resource_id: number;
  is_required: boolean;
  assignment_type: ServiceAssignmentType;
};

type ParsedQuestionOptions = {
  options: string[];
  presentation: QuestionPresentation;
};

export const serviceQuestionTypeOptions: Array<{
  value: FormQuestion["field_type"];
  label: string;
  requiresOptions?: boolean;
}> = [
  { value: "TEXT", label: "Short Text" },
  { value: "TEXTAREA", label: "Long Text" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "SELECT", label: "Multiple Choice / Select", requiresOptions: true },
  { value: "DATE", label: "Date" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
];

export function buildServiceShareUrl(service: Pick<Service, "id" | "shareable_link">, origin: string) {
  if (service.shareable_link) {
    return `${origin}/services/share/${service.shareable_link}`;
  }

  return `${origin}/services/${service.id}`;
}

export function parseQuestionOptions(raw: string | null | undefined): ParsedQuestionOptions {
  if (!raw) {
    return { options: [], presentation: "DROPDOWN" };
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return {
        options: parsed.filter((value): value is string => typeof value === "string"),
        presentation: "DROPDOWN",
      };
    }

    if (parsed && typeof parsed === "object") {
      const choices = Array.isArray(parsed.options)
        ? parsed.options.filter((value: unknown): value is string => typeof value === "string")
        : [];
      const presentation = parsed.presentation === "RADIO" ? "RADIO" : "DROPDOWN";

      return { options: choices, presentation };
    }
  } catch {
    return { options: [], presentation: "DROPDOWN" };
  }

  return { options: [], presentation: "DROPDOWN" };
}

export function serializeQuestionOptions(question: Pick<EditableQuestion, "field_type" | "options" | "presentation">) {
  if (question.field_type !== "SELECT") {
    return null;
  }

  const sanitizedOptions = question.options
    .map((option) => option.trim())
    .filter(Boolean);

  if (sanitizedOptions.length === 0) {
    return null;
  }

  return JSON.stringify({
    presentation: question.presentation,
    options: sanitizedOptions,
  });
}

export function toEditableQuestion(question: FormQuestion): EditableQuestion {
  const parsedOptions = parseQuestionOptions(question.options);

  return {
    client_id: `question-${question.id}`,
    id: question.id,
    question_text: question.question_text,
    field_type: question.field_type,
    is_required: question.is_required,
    options: parsedOptions.options,
    presentation: parsedOptions.presentation,
  };
}

export function toEditableAssignment(
  assignment: ServiceResourceAssignment,
): EditableServiceAssignment {
  return {
    resource_id: assignment.resource_id,
    is_required: assignment.is_required,
    assignment_type: assignment.assignment_type,
  };
}

export function getQuestionBadgeLabel(question: Pick<EditableQuestion, "field_type" | "presentation">) {
  if (question.field_type === "SELECT") {
    return question.presentation === "RADIO" ? "Multiple Choice" : "Dropdown";
  }

  const option = serviceQuestionTypeOptions.find((item) => item.value === question.field_type);
  return option?.label ?? question.field_type;
}

export function cloneServiceQuestions(questions: EditableQuestion[]) {
  return questions.map((question) => ({
    ...question,
    options: [...question.options],
  }));
}

export function cloneServiceAssignments(assignments: EditableServiceAssignment[]) {
  return assignments.map((assignment) => ({ ...assignment }));
}

