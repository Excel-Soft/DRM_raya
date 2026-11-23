import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type PortfolioCategoryOption = { id: string; name: string };

export function PortfolioCategorySelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Choose...",
  disabled,
}: {
  label: string;
  options: PortfolioCategoryOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = options.find((o) => o.id === value);
  const displayValue = selected?.name || placeholder;

  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">{label}</label>
      <div className="relative w-full" ref={dropdownRef}>
        <div
          className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className="truncate">{displayValue}</span>
          {isOpen ? <ChevronUp className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
        </div>

        {isOpen && !disabled && (
          <div className="absolute left-0 z-50 mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="sticky top-0 border-b border-gray-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-[13px] outline-none focus:border-[#00a65a] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="py-1">
              {filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`cursor-pointer px-3 py-2 text-[14px] transition-colors ${
                    value === opt.id
                      ? "bg-[#00a65a] text-white"
                      : "text-gray-700 hover:bg-[#00a65a] hover:text-white dark:text-zinc-300"
                  }`}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {opt.name}
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-2 text-[13px] text-gray-500">No results found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
