import { describe, expect, it } from "vitest";
import type { UserRole } from "@dorsu/shared-types";
import { actionPolicy, canPerform, canVisitRoute, homeRouteFor, routePolicy } from "./rbac";

const ROLES: UserRole[] = [
  "student",
  "counselor",
  "guidance_head",
  "faculty",
  "guidance_personnel",
  "admin",
];

describe("canVisitRoute", () => {
  it("allows only auth routes when signed out", () => {
    expect(canVisitRoute(null, "/login")).toBe(true);
    expect(canVisitRoute(undefined, "/register")).toBe(true);
    expect(canVisitRoute(null, "/reset-password")).toBe(true);
    expect(canVisitRoute(null, "/dashboard")).toBe(false);
    expect(canVisitRoute(null, "/appointments")).toBe(false);
  });

  it("keeps student-only routes student-only", () => {
    expect(canVisitRoute("student", "/appointments/new")).toBe(true);
    expect(canVisitRoute("counselor", "/appointments/new")).toBe(false);
    expect(canVisitRoute("guidance_head", "/appointments/new")).toBe(false);
  });

  it("gives head-only tools to guidance_head only", () => {
    for (const route of ["/users", "/analytics", "/security"] as const) {
      expect(canVisitRoute("guidance_head", route)).toBe(true);
      expect(canVisitRoute("counselor", route)).toBe(false);
      expect(canVisitRoute("faculty", route)).toBe(false);
      expect(canVisitRoute("student", route)).toBe(false);
    }
  });

  it("does not silently grant admin broad access", () => {
    expect(canVisitRoute("admin", "/dashboard")).toBe(false);
    expect(canVisitRoute("admin", "/users")).toBe(false);
    expect(canVisitRoute("admin", "/settings")).toBe(false);
  });

  it("has a policy entry for every role/route combination", () => {
    for (const role of ROLES) {
      for (const route of Object.keys(routePolicy) as (keyof typeof routePolicy)[]) {
        expect(typeof canVisitRoute(role, route)).toBe("boolean");
      }
    }
  });
});

describe("canPerform", () => {
  it("denies every action when signed out", () => {
    for (const action of Object.keys(actionPolicy) as (keyof typeof actionPolicy)[]) {
      expect(canPerform(null, action)).toBe(false);
    }
  });

  it("separates booking from assignment", () => {
    expect(canPerform("student", "appointment.book")).toBe(true);
    expect(canPerform("student", "appointment.assign")).toBe(false);
    expect(canPerform("guidance_head", "appointment.assign")).toBe(true);
    expect(canPerform("counselor", "appointment.assign")).toBe(false);
  });

  it("keeps clinical writes with counselors", () => {
    expect(canPerform("counselor", "appointment.confirm")).toBe(true);
    expect(canPerform("counselor", "appointment.complete")).toBe(true);
    expect(canPerform("counselor", "session-note.write")).toBe(true);
    expect(canPerform("guidance_head", "appointment.confirm")).toBe(false);
    expect(canPerform("faculty", "session-note.write")).toBe(false);
  });

  it("keeps referral creation with faculty/head and triage with head/counselor", () => {
    expect(canPerform("faculty", "referral.create")).toBe(true);
    expect(canPerform("guidance_head", "referral.create")).toBe(true);
    expect(canPerform("student", "referral.create")).toBe(false);
    expect(canPerform("guidance_head", "referral.assign")).toBe(true);
    expect(canPerform("counselor", "referral.confirm")).toBe(true);
    expect(canPerform("faculty", "referral.confirm")).toBe(false);
  });

  it("reserves analytics, user management, and announcements for the head", () => {
    for (const action of ["analytics.view", "user.manage", "announcement.publish"] as const) {
      expect(canPerform("guidance_head", action)).toBe(true);
      expect(canPerform("counselor", action)).toBe(false);
      expect(canPerform("faculty", action)).toBe(false);
      expect(canPerform("student", action)).toBe(false);
    }
  });

  it("does not grant admin domain actions", () => {
    for (const action of Object.keys(actionPolicy) as (keyof typeof actionPolicy)[]) {
      expect(canPerform("admin", action)).toBe(false);
    }
  });
});

describe("homeRouteFor", () => {
  it("routes each role to its landing page", () => {
    expect(homeRouteFor("student")).toBe("/appointments");
    expect(homeRouteFor("counselor")).toBe("/dashboard");
    expect(homeRouteFor("faculty")).toBe("/dashboard");
    expect(homeRouteFor("guidance_head")).toBe("/analytics");
    expect(homeRouteFor("admin")).toBe("/analytics");
  });
});
