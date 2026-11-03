import { cn } from "@/lib/cn";

/** A piece of a summary sentence; strong pieces carry the numbers, tones only states. */
export type SentencePart = { text: string; strong?: boolean; tone?: "error" | "warning" };

const tones = {
  rail: {
    base: "text-on-rail-variant",
    strong: "text-on-rail",
    error: "text-rail-error",
    warning: "text-rail-warning",
  },
  sheet: {
    base: "text-on-surface-variant",
    strong: "text-on-surface",
    error: "text-error",
    warning: "text-warning",
  },
} as const;

/**
 * What a screen opens with (FR-007, design-system.md §8): one sentence, its numbers
 * emphasized, late and at-risk counts in their state's tone. Announced when it changes.
 */
export function SummarySentence({
  parts,
  surface = "sheet",
  className,
}: {
  parts: SentencePart[];
  surface?: keyof typeof tones;
  className?: string;
}) {
  const tone = tones[surface];
  return (
    <p
      className={cn("max-w-[68ch] text-lede text-pretty", tone.base, className)}
      aria-live="polite"
    >
      {parts.map((part, index) =>
        part.strong ? (
          <strong
            key={index}
            className={cn("font-[650] whitespace-nowrap tabular-nums", tone[part.tone ?? "strong"])}
          >
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}
