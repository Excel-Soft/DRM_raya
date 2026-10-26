/** DRM views are client-heavy; avoid Next instant-nav segment validation noise in dev. */
export const instant = false;

export default function DrmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
