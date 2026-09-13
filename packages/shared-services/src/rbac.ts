import type { UserRole } from "@dorsu/shared-types";

/**
 * Role-based access policy — defined ONCE here, enforced by both apps'
 * routing guards (web layouts + mobile _layouts). Never reimplement per platform.
 */

export type AppRoute =
  | "/login"
  | "/register"
  | "/reset-password"
  | "/appointments"
  | "/appointments/new"
  | "/chat"
  | "/resources"
  | "/notifications"
  | "/settings"
  | "/availability"
  | "/students"
  | "/reports"
  | "/users"
  | "/analytics"
  | "/security"
  | "/announcements"
  | "/referrals"
  | "/feedback";

export type AppAction =
  | "appointment.book"
  | "appointment.assign"
  | "appointment.reject"
  | "appointment.confirm"
  | "appointment.complete"
  | "appointment.no_show"
  | "appointment.cancel"
  | "appointment.reschedule"
  | "pss10.submit"
  | "feedback.submit"
  | "chat.send"
  | "referral.create"
  | "referral.triage"
  | "availability.manage"
  | "session-note.write"
  | "announcement.publish"
  | "user.manage"
  | "break-glass.access"
  | "analytics.view";

/** Which roles may reach a route group (prefix match on AppRoute). */
export const routePolicy: Record<AppRoute, UserRole[]> = {
  "/login": ["student", "counselor", "guidance_head", "faculty"],
  "/register": ["student", "counselor", "guidance_head", "faculty"],
  "/reset-password": ["student", "counselor", "guidance_head", "faculty"],
  "/appointments": ["student", "counselor", "guidance_head"],
  "/appointments/new": ["student"],
  "/chat": ["student", "counselor", "guidance_head"],
  "/resources": ["student"],
  "/notifications": ["student", "counselor", "guidance_head", "faculty"],
  "/settings": ["student", "counselor", "guidance_head", "faculty"],
  "/availability": ["counselor", "guidance_head"],
  "/students": ["counselor", "guidance_head"],
  "/reports": ["counselor", "guidance_head"],
  "/users": ["guidance_head"],
  "/analytics": ["guidance_head"],
  "/security": ["guidance_head"],
  "/announcements": ["counselor", "guidance_head", "faculty", "student"],
  "/referrals": ["counselor", "guidance_head", "faculty"],
  "/feedback": ["student", "counselor", "guidance_head"],
};

/** Which roles may perform a domain action. */
export const actionPolicy: Record<AppAction, UserRole[]> = {
  "appointment.book": ["student"],
  "appointment.assign": ["guidance_head"],
  "appointment.reject": ["guidance_head"],
  "appointment.confirm": ["counselor"],
  "appointment.complete": ["counselor"],
  "appointment.no_show": ["counselor"],
  "appointment.cancel": ["student"],
  "appointment.reschedule": ["student"],
  "pss10.submit": ["student"],
  "feedback.submit": ["student"],
  "chat.send": ["student", "counselor", "guidance_head"],
  "referral.create": ["faculty", "guidance_head"],
  "referral.triage": ["counselor", "guidance_head"],
  "availability.manage": ["counselor", "guidance_head"],
  "session-note.write": ["counselor", "guidance_head"],
  "announcement.publish": ["guidance_head"],
  "user.manage": ["guidance_head"],
  "break-glass.access": ["counselor", "guidance_head"],
  "analytics.view": ["guidance_head"],
};

/** Can this role visit this route? */
export function canVisitRoute(role: UserRole | null | undefined, route: AppRoute): boolean {
  if (!role) return ["/login", "/register", "/reset-password"].includes(route);
  return routePolicy[route]?.includes(role) ?? false;
}

/** Can this role perform this action? */
export function canPerform(role: UserRole | null | undefined, action: AppAction): boolean {
  if (!role) return false;
  return actionPolicy[action]?.includes(role) ?? false;
}

/** Default landing route per role after login (used by both apps). */
export function homeRouteFor(role: UserRole): string {
  switch (role) {
    case "student":
      return "/appointments";
    case "counselor":
      return "/appointments";
    case "faculty":
      return "/referrals";
    case "guidance_head":
    case "admin":
      return "/analytics";
    default:
      return "/";
  }
}
