import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="mt-2 text-sm text-zinc-600">
        This route is not part of the Phase 1 scaffold.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm text-blue-600 underline">
        Back to foundation home
      </Link>
    </div>
  );
}
