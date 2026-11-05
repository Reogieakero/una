"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Role already resolved by the route-group layout. Read by client loading
 * boundaries so they can pick a role-correct skeleton **without** awaiting
 * `getCurrentProfile()` again — an async `loading.tsx` cannot render until
 * that round-trip finishes, so the previous page stays on screen.
 */
const ShellRoleContext = createContext<string | null>(null);

export function ShellRoleProvider({
  role,
  children,
}: {
  role: string | null;
  children: ReactNode;
}) {
  return <ShellRoleContext.Provider value={role}>{children}</ShellRoleContext.Provider>;
}

export function useShellRole(): string | null {
  return useContext(ShellRoleContext);
}
