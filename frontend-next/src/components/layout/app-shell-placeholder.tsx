import { cn } from "@/lib/utils/cn";

type AppShellPlaceholderProps = {
  title: string;
  children?: React.ReactNode;
};

/** Phase 3 will replace with ported sidebar + topbar from legacy. */
export function AppShellPlaceholder({
  title,
  children,
}: AppShellPlaceholderProps) {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          DRM WebExcels — Next foundation
        </p>
        <h1 className={cn("text-lg font-semibold")}>{title}</h1>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
