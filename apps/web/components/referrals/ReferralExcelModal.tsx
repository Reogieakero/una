"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Printer, Send, X } from "lucide-react";
import type { CreateReferralInput } from "@dorsu/shared-schemas";
import { createReferral } from "@dorsu/shared-services";
import { createClient } from "@/lib/supabase/client";
import { notifyStaff } from "@/lib/notify";
import { Badge, Button, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { CLASSIFICATION_COLUMNS, PRIORITIES, classificationSummary, statusLabel } from "./status";
import type { ReferralStudentOption } from "@/lib/hooks/use-referrals-board";
import { upsertReferralRow, type ReferralsRow } from "@/lib/hooks/use-referrals-board";
import { ReferralExcelPreview } from "./ReferralExcelPreview";
import { buildFilledReferralWorkbook } from "@/lib/referrals/referral-form-excel";
import { cn } from "@/lib/utils";

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Fetch the app seal and return raw PNG bytes as base64 (null when unavailable). */
async function fetchLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/images/dorsu-logo.png");
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  } catch {
    return null;
  }
}

const labelCls = "mb-1 block text-xs font-bold text-ink-muted";

/**
 * Faculty fill-up modal — type the student's details exactly as they appear
 * on the paper Counseling Referral Form, then either download the Excel/PDF
 * with every field auto-filled on the same horizontal line as its label, or
 * press Refer to file it with the Guidance Office (head is notified and
 * assigns a counselor).
 */
export function ReferralExcelModal({
  open,
  myName,
  students,
  facultyId,
  headIds,
  onSubmitted,
  onClose,
}: {
  open: boolean;
  myName: string;
  /** Enrolled students — the typed I.D. is matched against these on Refer. */
  students: ReferralStudentOption[];
  facultyId: string | null;
  headIds: string[];
  onSubmitted: () => void;
  onClose: () => void;
}) {
  const [studentName, setStudentName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [dateStr, setDateStr] = useState(todayLabel());
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [courseYear, setCourseYear] = useState("");
  const [relation, setRelation] = useState("");
  const [classifications, setClassifications] = useState<string[]>([]);
  const [classificationOther, setClassificationOther] = useState("");
  const [remarks, setRemarks] = useState("");
  const [referrer, setReferrer] = useState(myName);
  const [priority, setPriority] = useState<CreateReferralInput["priority"]>("medium");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "excel" | "pdf" | "refer">(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [step, setStep] = useState<"fill" | "preview">("fill");
  const qc = useQueryClient();

  // Reset + prefill each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStudentName("");
    setStudentNo("");
    setDateStr(todayLabel());
    setGender("");
    setAge("");
    setCourseYear("");
    setRelation("");
    setClassifications([]);
    setClassificationOther("");
    setRemarks("");
    setReferrer(myName);
    setPriority("medium");
    setErrors({});
    setBusy(null);
    setMenuKey(null);
    setStep("fill");
  }, [open, myName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const previewData = {
    studentName: studentName.trim(),
    studentNo: studentNo.trim(),
    dateLabel: dateStr.trim(),
    gender: gender.trim(),
    age: age.trim(),
    courseYear: courseYear.trim(),
    relation: relation.trim(),
    classifications,
    classificationOther: classificationOther.trim(),
    remarks: remarks.trim(),
    referrerName: referrer.trim(),
  };

  const downloadPdf = async () => {
    if (busy || !validate()) return;
    setBusy("pdf");
    try {
      const { buildReferralPdf } = await import("@/lib/referrals/referral-form-pdf");
      let seal: { data: Uint8Array; w: number; h: number } | null = null;
      try {
        const res = await fetch("/images/dorsu-logo.png");
        if (res.ok) {
          const bmp = await createImageBitmap(await res.blob());
          const MAX = 360;
          const s = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(bmp.width * s));
          canvas.height = Math.max(1, Math.round(bmp.height * s));
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            seal = { data: new Uint8Array(img.data), w: canvas.width, h: canvas.height };
          }
          if (typeof bmp.close === "function") bmp.close();
        }
      } catch {
        seal = null;
      }
      const { buffer, fileName } = await buildReferralPdf({ ...previewData, seal });
      const blob = new Blob([buffer as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("PDF downloaded — same filled form as the Excel template.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build the PDF — please try again.");
    } finally {
      setBusy(null);
    }
  };

  const toggleClassification = (c: string) => {
    setClassifications((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
    setErrors((e) => ({ ...e, classification: "", classificationOther: "" }));
  };

  const close = () => {
    if (!busy) onClose();
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!studentName.trim()) next.student = "Type the student's name.";
    if (!studentNo.trim()) next.studentNo = "Type the student's I.D. number.";
    if (!dateStr.trim()) next.date = "Enter the referral date.";
    if (!classifications.length) next.classification = "Tick at least one classification.";
    if (classifications.includes("Others") && !classificationOther.trim()) {
      next.classificationOther = "Say what “Others” means.";
    }
    if (remarks.trim().length < 10) next.remarks = "Give at least 10 characters of context.";
    if (!referrer.trim()) next.referrer = "Enter the referrer's name.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const download = async () => {
    if (busy || !validate()) return;

    setBusy("excel");
    try {
      const logoBase64 = await fetchLogoBase64();
      const { buffer, fileName } = await buildFilledReferralWorkbook({
        studentName: studentName.trim(),
        studentNo: studentNo.trim(),
        dateLabel: dateStr.trim(),
        gender: gender.trim(),
        age: age.trim(),
        courseYear: courseYear.trim(),
        relation: relation.trim(),
        classifications,
        classificationOther: classificationOther.trim(),
        remarks: remarks.trim(),
        referrerName: referrer.trim(),
        logoBase64,
      });
      const blob = new Blob([buffer as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Excel downloaded — every field filled on the official template.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build the Excel — please try again.");
    } finally {
      setBusy(null);
    }
  };

  const refer = async () => {
    if (busy || !validate()) return;
    // No I.D. check: most referred students have no account yet. When the
    // typed I.D. matches an enrolled student the referral links to them;
    // otherwise it files as a walk-in under the typed name/number.
    const match =
      students.find((s) => s.studentNo.trim().toLowerCase() === studentNo.trim().toLowerCase()) ?? null;
    if (!facultyId) {
      toast.error("Your faculty record isn't linked yet — ask the guidance head to finish setup.");
      return;
    }
    setBusy("refer");
    try {
      const reason = remarks.trim();
      const created = (await createReferral(createClient(), {
        studentId: match?.id,
        studentNameText: match ? undefined : studentName.trim(),
        studentNoText: match ? undefined : studentNo.trim(),
        reason,
        priority,
        studentGender: gender.trim() || undefined,
        studentAge: age.trim() || undefined,
        relationToClient: relation.trim() || undefined,
        caseClassification: classifications,
        classificationOther: classificationOther.trim() || undefined,
        referringFacultyId: facultyId,
      })) as { id?: string } | null;
      toast.success("Referral sent — the guidance head was notified to assign a counselor.");
      // Instant list update: prepend the created row (with its alias) so the
      // history shows it with the toast — onSubmitted refetch reconciles after.
      if (created?.id) {
        const alias = match ? (students.find((s) => s.id === match.id)?.alias ?? null) : null;
        upsertReferralRow(qc, created as unknown as ReferralsRow, alias);
      }
      const kinds = classificationSummary(classifications);
      // Fire-and-forget: modal close reflects the DB write, not delivery.
      void notifyStaff(headIds, {
        type: "referral",
        title: `New ${priority} referral (${kinds})`,
        body: reason.length > 120 ? `${reason.slice(0, 120)}…` : reason,
        link: created?.id ? `/referrals#focus-${created.id}` : "/referrals",
        ...(created?.id ? { dedupeKey: `referral:${created.id}:created` } : {}),
        tone: "info",
      });
      onSubmitted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the referral — please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-excel-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={close} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card sm:max-w-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="ref-excel-title" className="font-display text-lg font-bold text-ink">
              {step === "fill" ? "Fill up referral form" : "Preview referral form"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {step === "fill"
                ? "Type the details below — press Refer to file it with the Guidance Office, or preview it for the official Excel/PDF template (FM-DOrSU-GCTC-02)."
                : "Check every detail below — download it as Excel or PDF, or press Refer to file it with the Guidance Office."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={close} aria-label="Close" className="shrink-0">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {step === "fill" ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ref-excel-student">
                Name of Student
              </label>
              <Input
                id="ref-excel-student"
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setErrors((er) => ({ ...er, student: "" }));
                }}
                placeholder="Type the student's name"
              />
              <FieldError message={errors.student} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ref-excel-date">
                Date
              </label>
              <Input
                id="ref-excel-date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="Sep 18, 2026"
              />
              <FieldError message={errors.date} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="ref-excel-gender">
                Gender
              </label>
              <Dropdown
                menuKey="ref-excel-gender"
                openMenuKey={menuKey}
                onOpenChange={setMenuKey}
                value={gender}
                onChange={setGender}
                ariaLabel="Gender"
                options={["Male", "Female", "Prefer not to say"].map((g) => ({ value: g, label: g }))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ref-excel-age">
                Age
              </label>
              <Input
                id="ref-excel-age"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder=""
                inputMode="numeric"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ref-excel-course">
                Course &amp; Year
              </label>
              <Input
                id="ref-excel-course"
                value={courseYear}
                onChange={(e) => setCourseYear(e.target.value)}
                placeholder="e.g. BS Psych 3"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ref-excel-id">
                I.D. Number
              </label>
              <Input
                id="ref-excel-id"
                value={studentNo}
                onChange={(e) => {
                  setStudentNo(e.target.value);
                  setErrors((er) => ({ ...er, studentNo: "" }));
                }}
                placeholder="Type the student's I.D. number"
              />
              <FieldError message={errors.studentNo} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ref-excel-relation">
                Relation to the client
              </label>
              <Input
                id="ref-excel-relation"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                placeholder="e.g. Instructor, Class adviser"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-ink-muted">
              Case Classification <span className="text-red-600">*</span>
            </p>
            <div className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {CLASSIFICATION_COLUMNS.map((col, ci) => (
                <div key={ci} className="space-y-2">
                  {col.map((c) => {
                    const checked = classifications.includes(c);
                    return (
                      <div key={c}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={c}
                          onClick={() => toggleClassification(c)}
                          className="flex items-center gap-2.5 rounded px-1 py-0.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border-2",
                              checked ? "border-[#1e3a5f] bg-[#1e3a5f] text-white" : "border-ink/40 bg-white"
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                          </span>
                          <span>{c}</span>
                        </button>
                        {c === "Others" && checked && (
                          <span className="mt-1 flex items-center gap-2 pl-8">
                            <span className="shrink-0 text-xs text-ink-muted">please specify:</span>
                            <Input
                              value={classificationOther}
                              onChange={(e) => {
                                setClassificationOther(e.target.value);
                                setErrors((er) => ({ ...er, classificationOther: "" }));
                              }}
                              aria-label="Others, please specify"
                              placeholder=""
                            />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <FieldError message={errors.classification ?? errors.classificationOther} />
          </div>

          <div>
            <label className={labelCls} htmlFor="ref-excel-remarks">
              Remarks
            </label>
            <Textarea
              id="ref-excel-remarks"
              rows={4}
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setErrors((er) => ({ ...er, remarks: "" }));
              }}
              placeholder="Write the observations and reason for referral here…"
            />
            <FieldError message={errors.remarks} />
          </div>

          <div>
            <label className={labelCls} htmlFor="ref-excel-referrer">
              Referrer&apos;s Name
            </label>
            <Input
              id="ref-excel-referrer"
              value={referrer}
              onChange={(e) => {
                setReferrer(e.target.value);
                setErrors((er) => ({ ...er, referrer: "" }));
              }}
              placeholder="Your name as it appears on the form"
            />
            <FieldError message={errors.referrer} />
          </div>

          <div className="rounded-2xl border border-ink/10 bg-cream/60 p-4">
            <p className="text-xs font-bold text-ink-muted">Office routing</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
              Not on the paper form — decides how fast the head acts after you press Refer.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="ref-excel-priority">
                  Urgency
                </label>
                <Dropdown
                  menuKey="ref-excel-priority"
                  openMenuKey={menuKey}
                  onOpenChange={setMenuKey}
                  value={priority}
                  onChange={(v) => setPriority(v as CreateReferralInput["priority"])}
                  ariaLabel="Referral urgency"
                  options={PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) }))}
                />
              </div>
              <div>
                <span className={labelCls}>Status on refer</span>
                <div className="flex items-center gap-2 rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm">
                  <Badge tone="warning">Pending</Badge>
                  <span className="text-[11px] font-medium text-ink-faint">
                    Head assigns a counselor
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div className="mt-4 rounded-xl border border-ink/10 p-4 sm:p-6">
          <ReferralExcelPreview data={previewData} />
        </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={close}>
            Cancel
          </Button>
          {step === "fill" ? (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() => {
                if (validate()) setStep("preview");
              }}
            >
              Preview form
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setStep("fill")}>
                Back
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={downloadPdf}>
                {busy === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Printer className="h-4 w-4" aria-hidden />
                )}
                {busy === "pdf" ? "Building PDF…" : "Download PDF"}
              </Button>
              <Button size="sm" variant="primary" disabled={!!busy} onClick={download}>
                {busy === "excel" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                {busy === "excel" ? "Building Excel…" : "Download Excel"}
              </Button>
              <Button size="sm" variant="accent" disabled={!!busy} onClick={refer}>
                {busy === "refer" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                {busy === "refer" ? "Referring…" : "Refer"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
