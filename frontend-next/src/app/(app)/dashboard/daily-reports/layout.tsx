/** Client-heavy report views — opt out of Next instant-nav segment validation in dev. */
export const instant = false;

export default function DailyReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
