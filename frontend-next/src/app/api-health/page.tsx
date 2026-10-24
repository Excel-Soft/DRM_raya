import Link from "next/link";
import { SHARED_IMPORT_AUDIT } from "@/config/shared-import-audit";
import { ApiHealthPanel } from "./api-health-panel";

export default function ApiHealthPage() {
  const sharedAliasOk = SHARED_IMPORT_AUDIT.safeForClient.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <div>
        <Link href="/" className="text-sm text-blue-600 underline">
          ← Foundation home
        </Link>
        <h1 className="mt-4 text-xl font-semibold">Foundation health</h1>
      </div>

      <ApiHealthPanel />

      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <h2 className="font-medium">@shared alias (compile-time)</h2>
        <p className="mt-1 text-zinc-600">
          TypeScript resolves <code>@shared/validators</code> via{" "}
          <code>tsconfig paths</code>.
          {sharedAliasOk
            ? " Audit module loaded."
            : " Audit not loaded."}
        </p>
      </section>
    </div>
  );
}
