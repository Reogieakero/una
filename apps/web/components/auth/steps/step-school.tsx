import { BookOpen, Hash, Mail } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { RegisterStudentInput } from "@dorsu/shared-schemas";
import { FieldError, Input } from "@/components/ui/primitives";
import { YearLevelSelect } from "../year-level-select";

/** Step 2 — school email, student ID, year level, program. */
export function StepSchool({
  register,
  errors,
  yearLevel,
  onYearChange,
}: {
  register: UseFormRegister<RegisterStudentInput>;
  errors: FieldErrors<RegisterStudentInput>;
  yearLevel: string;
  onYearChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
          School email
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            id="email"
            placeholder="you@dorsu.edu.ph"
            autoComplete="email"
            autoFocus
            className="pl-11"
            {...register("email")}
          />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="studentNo" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
            Student ID number
          </label>
          <div className="relative">
            <Hash
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <Input id="studentNo" placeholder="Ex: 2021-00001" className="pl-11" {...register("studentNo")} />
          </div>
          <FieldError message={errors.studentNo?.message} />
        </div>
        <div>
          <span id="yearLevel-label" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
            What year are you in?
          </span>
          <YearLevelSelect
            value={yearLevel ?? ""}
            hasError={!!errors.yearLevel}
            onChange={onYearChange}
          />
          <FieldError message={errors.yearLevel?.message} />
        </div>
      </div>
      <div>
        <label htmlFor="program" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
          Your course
        </label>
        <div className="relative">
          <BookOpen
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            id="program"
            placeholder="Ex: BS Psychology"
            className="pl-11"
            {...register("program")}
          />
        </div>
        <FieldError message={errors.program?.message} />
      </div>
    </div>
  );
}
