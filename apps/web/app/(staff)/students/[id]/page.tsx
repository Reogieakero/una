"use client";

import { useParams } from "next/navigation";
import { StudentRecordView } from "@/components/students/StudentRecordView";

export default function StudentRecordPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) {
    return (
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <p className="text-sm font-bold text-ink">Student not found.</p>
      </div>
    );
  }
  return <StudentRecordView studentId={id} />;
}
