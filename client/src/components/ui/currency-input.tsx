import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  formatCurrencyInputValue,
  parseCurrencyInput,
} from "@/lib/currency";

interface CurrencyInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "type" | "inputMode"
  > {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Controlled currency input. Displays the value formatted as USD
 * (e.g. "$150,000") while emitting a clean numeric string
 * (e.g. "150000") via onValueChange for storage.
 */
export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(({ value, onValueChange, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      inputMode="decimal"
      value={formatCurrencyInputValue(value)}
      onChange={(e) => onValueChange(parseCurrencyInput(e.target.value))}
      {...props}
    />
  );
});
CurrencyInput.displayName = "CurrencyInput";
