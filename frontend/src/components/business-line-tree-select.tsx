import { Checkbox } from "@/components/ui/checkbox";

export type BusinessLineOption = { id: string; name: string };

export function BusinessLineTreeSelect({
  options,
  value,
  onChange,
}: {
  options: BusinessLineOption[];
  value: string[];
  onChange: (values: string[]) => void;
}) {
  const selected = new Set(value);

  const setSelected = (name: string, checked: boolean) => {
    if (checked) {
      if (selected.has(name)) return;
      onChange([...value, name]);
    } else {
      onChange(value.filter((v) => v !== name));
    }
  };

  return (
    <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products available</p>
      ) : (
        options.map((opt) => (
          <div
            key={opt.id}
            className="flex items-center gap-2 cursor-pointer select-none py-0.5"
            onClick={() => setSelected(opt.name, !selected.has(opt.name))}
          >
            <Checkbox
              checked={selected.has(opt.name)}
              onCheckedChange={(checked) => setSelected(opt.name, checked === true)}
              onClick={(e) => e.stopPropagation()}
              aria-label={opt.name}
            />
            <span className="text-sm flex-1">{opt.name}</span>
          </div>
        ))
      )}
    </div>
  );
}
