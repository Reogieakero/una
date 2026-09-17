/**
 * Shell body — plain content wrapper. Navigation lives in the left
 * sidebar rail (StaffSidebar) and the slim top bar (StaffNav), so every
 * route (including chat) renders its content here at full width.
 */
export function StaffShellBody({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
