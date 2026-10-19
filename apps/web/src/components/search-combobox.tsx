import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/**
 * A text field that searches the server as the user types and lets them pick one result
 * with the keyboard (arrows and Enter) or the pointer.
 */
export function SearchCombobox<T>({
  id,
  label,
  queryKey,
  search,
  value,
  onChange,
  itemKey,
  itemLabel,
  renderItem,
  placeholder,
  emptyText = "Sin resultados",
  footer,
  invalid,
  autoFocus,
}: {
  id: string;
  /** Accessible name of the text field; the visible label repeats it. */
  label: string;
  queryKey: readonly unknown[];
  search: (query: string) => Promise<T[]>;
  value: T | null;
  onChange: (value: T | null) => void;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  placeholder?: string;
  emptyText?: string;
  footer?: ReactNode;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [input, setInput] = useState(value ? itemLabel(value) : "");
  const query = useDebouncedValue(input);
  const results = useQuery({
    queryKey: [...queryKey, query],
    queryFn: () => search(query),
    placeholderData: keepPreviousData,
  });

  return (
    <Combobox
      items={results.data ?? []}
      filter={null}
      value={value}
      onValueChange={(next) => {
        onChange(next);
      }}
      inputValue={input}
      onInputValueChange={setInput}
      itemToStringLabel={itemLabel}
      isItemEqualToValue={(a, b) => itemKey(a) === itemKey(b)}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        aria-label={label}
        placeholder={placeholder}
        aria-invalid={invalid}
        autoFocus={autoFocus}
        className="w-full"
        data-ready={!results.isFetching && results.data !== undefined ? "" : undefined}
      />
      <ComboboxContent>
        <ComboboxEmpty>{results.isFetching ? "Buscando…" : emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: T) => (
            <ComboboxItem key={itemKey(item)} value={item}>
              {renderItem ? renderItem(item) : itemLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
        {footer}
      </ComboboxContent>
    </Combobox>
  );
}
