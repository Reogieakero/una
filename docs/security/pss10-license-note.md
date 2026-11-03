# PSS-10 Wording and Permission Note

**Status:** Pending verification
**Owner:** Project team / capstone adviser
**Last updated:** 24 October 2026

## Why this note exists

The product presents a 10-item stress check as the **Perceived Stress Scale (PSS-10)**.
Objective 2 names the PSS-10 explicitly, so the implementation must use the validated
instrument wording and response format — not a paraphrase.

The item text now lives in one place:
`packages/shared-services/src/assessments/pss10-instrument.ts`.

## Citation

- Cohen, S., Kamarck, T., & Mermelstein, R. (1983). A global measure of perceived
  stress. *Journal of Health and Social Behavior, 24*(4), 385–396.
- Cohen, S., & Williamson, G. (1988). Perceived stress in a probability sample of the
  United States. In S. Spacapan & S. Oskamp (Eds.), *The social psychology of health*.

## What must be verified before external distribution

- [ ] The exact 10 item stems and the “last month” instruction match the authoritative
      published version.
- [ ] The five response labels (`Never` … `Very often`) and the 0–4 scoring match.
- [ ] Reverse-scored items are Q4, Q5, Q7, Q8 (0-based indexes 3, 4, 6, 7).
- [ ] The project has permission or a documented licence basis for reproducing the
      wording in a deployed application.
- [ ] Any translation (e.g., Cebuano/Filipino) has its own validated version; do not
      machine-translate the instrument.

## Rules

1. Do not paraphrase, reorder, or relabel items to make the UI “friendlier.”
2. Do not claim “validated PSS-10” in the manuscript until this note is completed.
3. If permission cannot be confirmed before the defense, either:
   - rename the feature to **“stress check-in”** and remove the PSS-10 claim, or
   - present it as a study-only use with the limitation stated explicitly.

## Evidence to attach

- Source URL or PDF of the instrument.
- Permission email/licence terms, or a written adviser decision.
- Date verified and by whom.
