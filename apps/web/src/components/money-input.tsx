import { formatCop, parseCop } from "@domy/domain";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/**
 * Pesos typed as "$ 13.000", "13000", or "13 000" (FR-012). Reports whole pesos, or null
 * while the text is empty or not a valid amount.
 */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : formatCop(value));
  const [shown, setShown] = useState(value);
  // An outside change of the value (for example, a new calculated fee) rewrites the text.
  if (value !== shown) {
    setShown(value);
    if (value !== parseCop(text)) setText(value === null ? "" : formatCop(value));
  }

  return (
    <Input
      {...props}
      inputMode="numeric"
      className="tabular-nums"
      value={text}
      onChange={(event) => {
        const amount = parseCop(event.target.value);
        setText(event.target.value);
        setShown(amount);
        onChange(amount);
      }}
      onBlur={(event) => {
        const amount = parseCop(text);
        if (amount !== null) setText(formatCop(amount));
        onBlur?.(event);
      }}
    />
  );
}
