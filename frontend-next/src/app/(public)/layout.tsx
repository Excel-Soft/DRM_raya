/** Public routes — no app shell; AuthGate skipped when pathname is /auth. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
