import { cn } from "@/lib/cn";

export type StageCount<Key extends string> = {
  key: Key;
  label: string;
  count: number;
  /** One line under the count: "5 registrados · 3 asignados", "43 % de hoy". */
  sub: string;
  /** The stage's square and bar segment, a `bg-*` class of a `rail-*` tone. */
  tone: string;
};

/**
 * Stage counts on pizarra (design-system.md §8, FR-018): a bar of 8 px segments proportional
 * to each stage, then one button per stage. Pressing one filters the list (`aria-pressed`,
 * filled lime); pressing it again clears the filter.
 */
export function StageCounts<Key extends string>({
  stages,
  selected,
  onSelect,
}: {
  stages: StageCount<Key>[];
  selected: Key | undefined;
  onSelect: (key: Key | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="flex gap-[3px]">
        {stages
          .filter((stage) => stage.count > 0)
          .map((stage) => (
            <span
              key={stage.key}
              className={cn(
                "h-2 min-w-1.5 origin-left rounded-xs motion-safe:animate-[stage-draw_700ms_cubic-bezier(0.05,0.7,0.1,1)_both]",
                stage.tone,
              )}
              style={{ flex: `${String(stage.count)} 1 0` }}
            />
          ))}
      </div>
      <div
        role="group"
        aria-label="Filtrar los envíos por etapa"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(9.5rem,100%),1fr))] gap-1"
      >
        {stages.map((stage) => (
          <button
            key={stage.key}
            type="button"
            aria-pressed={selected === stage.key}
            onClick={() => {
              onSelect(selected === stage.key ? undefined : stage.key);
            }}
            className="group flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 text-left text-on-rail transition-colors hover:bg-rail-raised aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            <span className="flex items-center gap-2 text-label-l">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-[3px] group-aria-pressed:bg-on-accent",
                  stage.tone,
                )}
              />
              {stage.label}
            </span>
            <span className="text-figure tabular-nums">{stage.count}</span>
            <span className="text-body-s text-on-rail-variant group-aria-pressed:text-on-accent min-[821px]:whitespace-nowrap">
              {stage.sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
