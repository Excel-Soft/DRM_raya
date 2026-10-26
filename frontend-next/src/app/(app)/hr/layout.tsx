/** HR / Attendance views are client-heavy — opt out of instant-nav validation in dev. */
export const instant = false;

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return children;
}
