import { Checkbox } from "@/components/ui/checkbox";

// PLACEHOLDER: the real business-line-tree-select implementation was missing
// from this checkout (imported by add-customer.tsx but absent from
// src/components). This is a minimal flat multi-select standing in for it —
// replace with the real tree-select implementation once restored.
export function BusinessLineTreeSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (option: string) => {
    onChange(
      value.includes(option) ? value.filter((v) => v !== option) : [...value, option],
    );
  };

  return (
    <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products available</p>
      ) : (
        options.map((option) => (
          <div key={option} className="flex items-center space-x-2">
            <Checkbox
              id={`business-line-${option}`}
              checked={value.includes(option)}
              onCheckedChange={() => toggle(option)}
            />
            <label htmlFor={`business-line-${option}`} className="text-sm cursor-pointer">
              {option}
            </label>
          </div>
        ))
      )}
    </div>
  );
}
