# Usability and Accessibility Study Protocol (P1.6)

Status: **protocol ready — no participants have been run.** This document contains no results. Do not describe Objective 11 as fully achieved until the study is executed and the findings are written up.

Related: `P1_HONESTY_GAPS_PLAN.md` (P1-D/P1.6), `Objective_Achievement_Report.md` §1.6 and §5.2.

---

## 1. Purpose

Measure whether real, non-technical users can complete the core tasks, and identify accessibility barriers under WCAG 2.1 AA. The study is **formative** (find and fix problems), not a statistical validation of the product.

## 2. Participants

Target **16 participants**, recruited from the intended roles:

| Role | Target | Inclusion |
|---|---:|---|
| Student | 5 | Currently enrolled; has booked or would book a guidance session |
| Counselor | 5 | Guidance staff who run sessions and write notes |
| Faculty | 3 | Teaching staff who can refer a student |
| Guidance head | 3 | Supervisory/analytics role |

- At least 3 participants should have low prior experience with similar systems; at least 2 should use a screen reader, keyboard-only navigation, or enlarged text regularly.
- Participation is voluntary and unpaid unless the institution approves an incentive. No participant is a member of the build team.
- Do not record names, student numbers, real session notes, PSS-10 answers, or chat content in the study log. Use participant codes (P01–P16).

## 3. Session format

- **45–60 minutes**, one participant at a time, in person or on a video call with screen sharing.
- Moderator + note-taker. The moderator reads tasks aloud and does not coach unless the participant is blocked for more than 2 minutes.
- Each participant signs a short consent note covering purpose, recording, anonymization, and the right to stop.
- Use a **local or staging build with seeded demo data**, never production records.
- Record only screen and audio if separately consented; otherwise take timestamped notes only.

## 4. Task scripts

Tasks are phrased as goals, not clicks. Mark success only if the participant completes the goal without moderator help.

### Student (mobile)

1. Find when your next session is and who it is with.
2. Book a session for an in-person concern, choosing a day and time.
3. Complete the PSS-10 check-in and explain what the result band means to you.
4. Find the message thread with your counselor and send one message.
5. Cancel an upcoming session and confirm it is cancelled.

### Counselor (web)

1. Find today's assigned sessions and open one.
2. Mark a session complete.
3. Write and save a session note for that completed session.
4. Set one availability window for next week.
5. Find the referral queue and open a pending referral's reason.

### Faculty (web)

1. Refer a student for an academic concern.
2. Confirm the referral was received and find its status.
3. Explain what information the Guidance Office can see about the referral.

### Guidance head (web)

1. Find how many sessions occurred in the last 30 days.
2. Find the current referral pipeline and identify one pending referral.
3. Assign a pending appointment to a counselor.
4. Open the security/audit view and explain what it records.
5. Export or view a report section and explain one KPI.

## 5. Metrics

Per task and participant:

- **Success:** completed unaided / completed with help / failed.
- **Time on task:** start to completion, in seconds (stop at 5 minutes or when the participant gives up).
- **Errors:** wrong route, wrong record, destructive action, or recovery needed.
- **Assistance:** number and type of moderator prompts.
- **Satisfaction:** single ease question after each task (1–7).

After all tasks:

- **SUS** (10-item System Usability Scale), reported as the standard 0–100 score; report median and range, not a p-value.
- **SEQ** per task (1–7).
- **Open feedback:** “What was confusing?”, “What would you change first?”

Accessibility observations:

- Keyboard-only completion of the same tasks on web.
- Screen-reader traversal of login, booking/check-in, counselor note form, referral form, and reports.
- 200% text zoom / large text without loss of content or function.
- Contrast spot-checks on primary buttons, status pills, helper text, and charts.
- Visible focus, form labels/errors, dialog focus trapping, and reduced-motion behavior.

## 6. WCAG 2.1 AA audit

Run a focused audit on the five highest-risk surfaces:

1. Login and password reset
2. Mobile booking + PSS-10 check-in
3. Counselor session note form
4. Faculty referral form
5. Head reports (KPI cards, tables, charts, export)

Use automated tooling (axe DevTools or Lighthouse) **plus** manual checks: keyboard order, focus visibility, name/role/value, error identification, contrast, text resizing, and motion. Record each finding with WCAG success criterion, surface, severity, evidence, and recommended fix.

Severity scale:

| Severity | Meaning |
|---|---|
| Critical | Blocks a core task for assistive-technology users |
| High | Significant barrier or misleading failure |
| Medium | Workaround exists but is burdensome |
| Low | Polish / minor inconsistency |

High and critical findings must be fixed, or accepted in writing with rationale and a dated plan, before Objective 11 can be marked complete.

## 7. Data handling

- Store raw notes and recordings in an access-controlled folder, not in the repository.
- The repo may contain only anonymized aggregate results and de-identified quotes.
- Delete recordings after the report is accepted, or at the institution's retention deadline.
- Never include real student names, referral reasons, notes, PSS-10 answers, or chat text in screenshots or quotes.

## 8. Analysis and reporting

Write `docs/usability-study-report.md` with:

- Participant profile (counts by role, experience; no identities).
- Task-success table and time-on-task summary per role.
- Error and assistance themes with severity.
- SUS median/range and per-task SEQ.
- Accessibility findings by WCAG criterion and severity.
- Prioritized fixes, owner, and status (fixed / accepted / deferred).
- Explicit limitations: small formative sample, seeded data, single institution.

Then update `Objective_Achievement_Report.md` §1.6, Objective 11, and the ISO 25010 usability row with the actual results and the final ISO 25010 table.

## 9. Recruitment and calendar

1. Ask the Guidance Office to nominate counselors and the head; ask faculty coordinators for teaching staff; recruit students through general announcement channels (not through counselors' caseloads).
2. Schedule 16 slots across 2 weeks, with 2 buffer slots.
3. Pilot with 1 staff member to test the script and timing; exclude the pilot from the 16.
4. Run sessions, then allow 2–3 days for analysis and 3–5 days for high-severity fixes.
5. Re-test only the fixed high-severity items with 2–3 participants; do not rerun the full study unless the UI changes materially.

**Exit criteria for P1.6:** at least 5 students, 5 counselors, 3 faculty, and 3 head participants completed; SUS and task metrics reported; WCAG findings recorded; high/critical issues fixed or accepted in writing.
