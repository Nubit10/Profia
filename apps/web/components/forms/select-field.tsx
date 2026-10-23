"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

type Props = {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
};

/** Select controlado para usar con el Controller de React Hook Form. */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  disabled,
}: Props) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select
      items={items}
      value={value ?? null}
      onValueChange={(next) => onChange((next as string | null) ?? "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
