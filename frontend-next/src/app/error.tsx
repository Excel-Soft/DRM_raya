"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-zinc-900">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-zinc-600">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}
