"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { registerStaffSchema, type RegisterStaffInput } from "@dorsu/shared-schemas";
import { Button, Card, FieldError, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const ROLE_OPTIONS = [
  { value: "counselor", label: "Counselor" },
  { value: "faculty", label: "Faculty" },
  { value: "guidance_head", label: "Guidance head" },
];

/** Head-only staff provisioning — the only writer of staff accounts (see /api/auth/register). */
export default function AddStaffPage() {
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const { register, handleSubmit, formState, setValue, watch, reset } = useForm<RegisterStaffInput>({
    resolver: zodResolver(registerStaffSchema),
    defaultValues: { role: "counselor" },
  });
  const role = watch("role");
  const pw = watch("password") ?? "";
  const pwReg = register("password");
  const rules = [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Upper and lower case letters", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "At least one number", ok: /\d/.test(pw) },
  ];
  const matchState = !confirm ? null : confirm === pw && pw.length > 0;

  const onSubmit = handleSubmit(async (v) => {
    if (confirm !== v.password) return setError("Those passwords don't match. Please try again.");
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) return setError(body?.error ?? "Couldn't create that account.");
    setCreated(v.fullName);
    reset({ role: "counselor" });
    setConfirm("");
    setPwDone(false);
  });

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/users">Users</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Add staff</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">Add staff</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          Create a counselor, faculty, or head account. They can sign in immediately with
          the password you set — ask them to change it after first login.
        </p>
      </div>

      {created && (
        <Card className="border-green-300 bg-green-50">
          <p className="text-sm font-bold text-green-800">Account created for {created}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/users"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-2.5 font-display text-sm font-semibold text-white shadow-soft transition-all hover:bg-primary-700"
            >
              View in directory
            </Link>
            <Button variant="outline" onClick={() => setCreated(null)}>
              Add another
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted">Role</label>
            <Dropdown
              menuKey="staff-role"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={role}
              onChange={(v) => setValue("role", v as RegisterStaffInput["role"], { shouldValidate: true })}
              ariaLabel="Staff role"
              options={ROLE_OPTIONS}
            />
            <FieldError message={formState.errors.role?.message} />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted">Employee no. (optional)</label>
            <Input placeholder="EMP-2024-001" {...register("employeeNo")} />
            <FieldError message={formState.errors.employeeNo?.message} />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted">Full name</label>
            <Input placeholder="Maria C. Santos" autoComplete="name" {...register("fullName")} />
            <FieldError message={formState.errors.fullName?.message} />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted">Email</label>
            <Input placeholder="msantos@dorsu.edu.ph" autoComplete="email" {...register("email")} />
            <FieldError message={formState.errors.email?.message} />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="staff-password">Password</label>
            <div className="relative">
              <Input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                placeholder="8+ chars, upper, lower & number"
                autoComplete="new-password"
                className="pr-11"
                {...pwReg}
                onBlur={(e) => {
                  pwReg.onBlur(e);
                  setPwDone(true);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <FieldError message={formState.errors.password?.message} />
            {pwDone && (
              <ul className="mt-1.5 space-y-1" aria-label="Password requirements">
                {rules.map((r) => (
                  <li
                    key={r.label}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${r.ok ? "text-green-700" : "text-ink-faint"}`}
                  >
                    {r.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="staff-confirm">Confirm password</label>
            <div className="relative">
              <Input
                id="staff-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat the password"
                autoComplete="new-password"
                className="pr-11"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {matchState !== null && (
              <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${matchState ? "text-green-700" : "text-red-600"}`}>
                {matchState ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                {matchState ? "Passwords match" : "Passwords don't match"}
              </p>
            )}
          </div>
          {role === "counselor" && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold text-ink-muted">Specialization (optional)</label>
              <Input placeholder="e.g. Academic stress" {...register("specialization")} />
              <FieldError message={formState.errors.specialization?.message} />
            </div>
          )}
          {role === "faculty" && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold text-ink-muted">Department (optional)</label>
              <Input placeholder="e.g. College of Arts and Sciences" {...register("department")} />
              <FieldError message={formState.errors.department?.message} />
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-snug text-red-700 md:col-span-2"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end md:col-span-2">
            <Button disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
