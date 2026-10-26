"use client";

type Props = {
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
};

/** Flat multi-select — matches legacy placeholder in Vite checkout. */
export function BusinessLineTreeSelect({ options, value, onChange }: Props) {
  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      {options.length === 0 ? (
        <p className="text-sm text-zinc-500">No products available</p>
      ) : (
        options.map((option) => (
          <label key={option} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={value.includes(option)}
              onChange={() => toggle(option)}
            />
            <span className="flex-1 break-words">{option}</span>
          </label>
        ))
      )}
    </div>
  );
}
