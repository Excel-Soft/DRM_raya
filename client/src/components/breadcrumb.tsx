import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center gap-2 text-sm", className)} data-testid="breadcrumb">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span
            className={cn(
              index === items.length - 1
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
            data-testid={`breadcrumb-item-${index}`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </nav>
  );
}
