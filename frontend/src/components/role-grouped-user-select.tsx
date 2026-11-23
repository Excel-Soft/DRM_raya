// Searchable employee picker grouped by role title (see lib/user-role-groups).
//
// A user with several roles (e.g. Sales Manager + Sales Executive) is listed
// under each role, but every option has its own internal key (role + user), so
// the trigger never shows the name twice (the Radix Select bug: duplicate item
// values render every matching label -> "Rehman FaisalRehman Faisal").
// The page still gets back its own value (user id, or name — see getValue) plus
// the role it was picked under; disabled (role 54) profiles are excluded.
import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { groupUsersByRoleTitle, isActiveEmployee } from "@/lib/user-role-groups";
import { cn } from "@/lib/utils";

export interface RoleGroupedUserSelectMeta {
  roleId: string | null;
  roleTitle: string | null;
  user: any | null;
}

interface ExtraOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  users: any[] | null | undefined;
  value: string;
  onChange: (value: string, meta: RoleGroupedUserSelectMeta) => void;
  /** What the page stores for a user (default: id). */
  getValue?: (u: any) => string;
  /** Display name (default: fullName / full_name / name / username). */
  getLabel?: (u: any) => string;
  /** Static options shown above the role groups (e.g. "All"). */
  extraOptions?: ExtraOption[];
  placeholder?: string;
  className?: string;
  searchPlaceholder?: string;
  /** false = one plain A-Z list (no role sections); disabled users still hidden. */
  grouped?: boolean;
  disabled?: boolean;
}

const defaultLabel = (u: any) => String(u?.fullName || u?.full_name || u?.name || u?.username || "");

export function RoleGroupedUserSelect({
  users,
  value,
  onChange,
  getValue = (u) => String(u?.id ?? ""),
  getLabel = defaultLabel,
  extraOptions = [],
  placeholder = "Choose...",
  className,
  searchPlaceholder = "Search user...",
  grouped = true,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  // Which role section the current value was picked from (for the tick + label).
  const [pickedRoleId, setPickedRoleId] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!grouped) {
      // Plain list: every active user once, A-Z (no role sections).
      const seen = new Set<string>();
      const plain = (users ?? [])
        .filter((u) => isActiveEmployee(u) && getLabel(u) && getValue(u))
        .filter((u) => (seen.has(getValue(u)) ? false : (seen.add(getValue(u)), true)))
        .sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
      return [{ roleId: "", role: "", users: plain }];
    }
    return groupUsersByRoleTitle(users).map((g) => ({
      ...g,
      users: g.users.filter((u) => getLabel(u) && getValue(u)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, grouped]);

  const extra = extraOptions.find((o) => o.value === value);
  const selectedGroup =
    groups.find((g) => g.roleId === pickedRoleId && g.users.some((u) => getValue(u) === value)) ??
    groups.find((g) => g.users.some((u) => getValue(u) === value));
  const selectedUser = selectedGroup?.users.find((u) => getValue(u) === value);
  // Users that are not in any group (e.g. a disabled profile chosen earlier) still show their name.
  const fallbackUser = !selectedUser && value ? (users ?? []).find((u) => getValue(u) === value) : null;

  const triggerLabel = extra
    ? extra.label
    : selectedUser
      ? getLabel(selectedUser)
      : fallbackUser
        ? getLabel(fallbackUser)
        : value && value !== "none" && value !== "all" && value !== "All"
          ? value
          : "";
  const roleSuffix = grouped && !extra && selectedUser && selectedGroup ? selectedGroup.role : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate text-left", !triggerLabel && "text-muted-foreground")}>
            {triggerLabel || placeholder}
            {roleSuffix && <span className="text-muted-foreground"> · {roleSuffix}</span>}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-80">
            <CommandEmpty>No user found.</CommandEmpty>
            {extraOptions.length > 0 && (
              <CommandGroup>
                {extraOptions.map((o) => (
                  <CommandItem
                    key={`extra-${o.value}`}
                    value={`__extra__ ${o.label} ${o.value}`}
                    disabled={o.disabled}
                    onSelect={() => {
                      setPickedRoleId(null);
                      onChange(o.value, { roleId: null, roleTitle: null, user: null });
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {groups.map((g) => (
              <CommandGroup
                key={`${g.roleId}-${g.role}`}
                heading={g.role ? <span className="font-bold text-[#00a65a] dark:text-zinc-400">{g.role}</span> : undefined}
              >
                {g.users.map((u) => {
                  const v = getValue(u);
                  const isSelected = value === v && selectedGroup?.roleId === g.roleId;
                  return (
                    <CommandItem
                      key={`${g.roleId}-${u.id ?? v}`}
                      // Unique per role section; also what the search box matches on.
                      value={`${getLabel(u)} ${u.email ?? ""} ${g.role} ${g.roleId}:${u.id ?? v}`}
                      onSelect={() => {
                        setPickedRoleId(g.roleId);
                        onChange(v, { roleId: g.roleId, roleTitle: g.role, user: u });
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      {getLabel(u)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
