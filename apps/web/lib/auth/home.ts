import type { UserRole } from "@dorsu/shared-types";

/**
 * Post-auth landing page per role — single source so login, registration
 * and password-update all route consistently. Students land on the public
 * site (their home is the mobile app); staff land on their workspace.
 */
export function homeForRole(role: UserRole | string | null | undefined): string {
  switch (role) {
    case "counselor":
      return "/dashboard";
    case "faculty":
      return "/dashboard";
    case "guidance_head":
      return "/dashboard";
    case "admin":
      return "/settings";
    case "student":
    default:
      return "/";
  }
}
