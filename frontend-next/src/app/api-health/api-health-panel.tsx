"use client";

import { useCallback, useState } from "react";
import { fetchDbHealth, type DbHealthResponse } from "@/lib/api";

type CheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: DbHealthResponse; at: string }
  | { status: "failed"; message: string; at: string };

export function ApiHealthPanel() {
  const [state, setState] = useState<CheckState>({ status: "idle" });

  const runCheck = useCallback(async () => {
    setState({ status: "loading" });
    const at = new Date().toISOString();
    try {
      const data = await fetchDbHealth();
      if (data.ok) {
        setState({ status: "ok", data, at });
      } else {
        setState({
          status: "failed",
          message: data.message ?? "Health endpoint returned ok: false",
          at,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Request failed (backend unreachable?)";
      setState({ status: "failed", message, at });
    }
  }, []);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">Express API connectivity</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Calls <code className="text-xs">GET /api/health/db</code> through Next
        rewrites. Start the backend before running the check.
      </p>
      <button
        type="button"
        onClick={() => void runCheck()}
        disabled={state.status === "loading"}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {state.status === "loading" ? "Checking…" : "Run health check"}
      </button>

      {state.status === "idle" && (
        <p className="mt-4 text-sm text-amber-700">
          Not run yet — result is unknown (not a pass).
        </p>
      )}

      {state.status === "ok" && (
        <pre className="mt-4 overflow-x-auto rounded bg-emerald-50 p-3 text-xs text-emerald-900">
          PASS @ {state.at}
          {"\n"}
          {JSON.stringify(state.data, null, 2)}
        </pre>
      )}

      {state.status === "failed" && (
        <pre className="mt-4 overflow-x-auto rounded bg-red-50 p-3 text-xs text-red-900">
          BLOCKED / FAIL @ {state.at}
          {"\n"}
          {state.message}
        </pre>
      )}
    </div>
  );
}
