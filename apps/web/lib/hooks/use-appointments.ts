"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  bookAppointment,
  getLatestPss10,
  listCounselorAppointments,
  submitPss10,
} from "@dorsu/shared-services";
import type { CreateAppointmentInput } from "@dorsu/shared-schemas";

/**
 * Web data hooks — thin TanStack Query wrappers around shared services.
 * No business logic here; rules live in packages/shared-services.
 */
export function useLatestPss10(studentId: string | undefined) {
  return useQuery({
    queryKey: ["pss10-latest", studentId],
    enabled: !!studentId,
    queryFn: async () => getLatestPss10(createClient(), studentId!),
  });
}

export function useCounselorQueue(counselorId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ["appointments", counselorId, status],
    enabled: !!counselorId,
    queryFn: () => listCounselorAppointments(createClient(), counselorId!, status),
  });
}

export function useSubmitPss10(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: number[]) => submitPss10(createClient(), { studentId, answers }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pss10-latest"] }),
  });
}

export function useBookAppointment(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: CreateAppointmentInput) =>
      bookAppointment(createClient(), {
        studentId,
        counselorId: v.counselorId ?? null,
        scheduledAt: new Date(v.scheduledAt),
        mode: v.mode,
        concern: v.concern,
        isAnonymous: v.isAnonymous,
        pss10Id: v.pss10Id,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}
