"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { cn } from "@/lib/utils/cn";
import { accountUserLabel, uniqueAccountUsers, type AccountListUser } from "@/modules/account/account-users";
import { drmFieldClass } from "@/modules/drm/drm-ui";

type Props = {
  users: AccountListUser[];
  valueUserId: string;
  onValueUserIdChange: (userId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/** Person picker — values are user ids so duplicate display names do not break Radix Select. */
export function AccountPersonSelect({
  users,
  valueUserId,
  onValueUserIdChange,
  placeholder = "Choose person…",
  className,
  disabled,
}: Props) {
  const list = uniqueAccountUsers(users);

  return (
    <Select value={valueUserId || undefined} onValueChange={onValueUserIdChange} disabled={disabled}>
      <SelectTrigger className={cn(drmFieldClass, "h-9 w-full text-sm", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {list.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {accountUserLabel(u)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
