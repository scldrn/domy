import FilterOffIcon from "@material-symbols/svg-400/rounded/filter_alt_off.svg?react";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { OptionSelect } from "@/components/option-select";
import { Field } from "@/components/ui/field";

const all = "all";

type Tab<Key extends string> = { key: Key | undefined; label: string; count: number };
type Select = {
  label: string;
  /** What the select says when it filters nothing: "Todos los clientes". */
  allLabel: string;
  value: string | undefined;
  options: { id: string; name: string }[];
  onChange: (value: string | undefined) => void;
};

/**
 * A list's filters (contracts/components.md, design-system.md §8): the title with its count on
 * the left, one alert chip and the selects on the right, the status tabs under them, and
 * "Quitar filtros" when anything is set.
 */
export function FilterBar<Key extends string>({
  title,
  tabs,
  selectedTab,
  onTab,
  alert,
  selects,
  onClear,
}: {
  title: ReactNode;
  tabs: Tab<Key>[];
  selectedTab: Key | undefined;
  onTab: (key: Key | undefined) => void;
  alert: { label: string; count: number; pressed: boolean; onToggle: () => void };
  selects: Select[];
  /** Shown only while some filter is set. */
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 max-[820px]:px-4">
        {title}
        <div className="flex flex-wrap items-center gap-2 max-[820px]:w-full">
          <button
            type="button"
            aria-pressed={alert.pressed}
            onClick={alert.onToggle}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-outline-variant px-4 text-label-l whitespace-nowrap text-on-surface-variant transition-colors hover:bg-sheet-alt hover:text-on-surface aria-pressed:border-on-surface aria-pressed:bg-on-surface aria-pressed:text-surface"
          >
            {alert.label} <span className="font-normal tabular-nums">{alert.count}</span>
          </button>
          {selects.map((select) => (
            <Field
              key={select.label}
              className="w-52 max-[820px]:w-auto max-[820px]:flex-[1_1_9rem]"
            >
              <OptionSelect
                label={select.label}
                hideLabel
                value={select.value ?? all}
                onChange={(value) => {
                  select.onChange(value === all ? undefined : value);
                }}
                options={[
                  { value: all, label: select.allLabel },
                  ...select.options.map((option) => ({ value: option.id, label: option.name })),
                ]}
              />
            </Field>
          ))}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-label-l text-on-surface-variant underline decoration-outline-variant underline-offset-4 hover:text-on-surface hover:decoration-current"
            >
              <Icon symbol={FilterOffIcon} size={20} />
              Quitar filtros
            </button>
          )}
        </div>
      </div>
      <div
        role="group"
        aria-label="Envíos por etapa"
        className="flex overflow-x-auto px-3 [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key ?? "all"}
            type="button"
            aria-pressed={selectedTab === tab.key}
            onClick={() => {
              onTab(tab.key);
            }}
            className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 px-3 text-label-l whitespace-nowrap text-on-surface-variant after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full hover:text-on-surface aria-pressed:font-bold aria-pressed:text-on-surface aria-pressed:after:bg-on-surface"
          >
            {tab.label} <span className="font-normal tabular-nums">{tab.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
