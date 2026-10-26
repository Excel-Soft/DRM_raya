/** Events CRUD views are client-heavy — opt out of instant-nav validation in dev. */
export const instant = false;

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
