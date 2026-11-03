# Objective 7 scope decision: announcement management

**Decision date:** 24 October 2026
**Status:** Decided — no events MVP in P1
**Owners:** Capstone team

## Original wording

> Implement an event management feature for publishing announcements and
> counseling-related activities.

## Renamed objective

> Implement an **announcement management** feature for publishing guidance
> announcements and counseling-related activities to the DOrSU community.

The rename is deliberate. “Event management” in common software usage implies a
scheduled activity with a date/time range, venue, registration/RSVP, and
attendance. This system does not have those things, and P1 does not build them.
Calling the announcements module “events” would overstate the implementation.

## What the system actually provides

| Capability | Evidence |
|---|---|
| Staff announcement page | `apps/web/app/(staff)/announcements/page.tsx` |
| Compose form | `apps/web/components/announcements/AnnouncementForm.tsx` |
| Image upload + validation | `apps/web/components/announcements/image-upload.tsx` |
| Audience targeting | `student`, `counselor`, `faculty`, or everyone; role-filtered feeds |
| Draft / publish / unpublish / delete | `save(publish)` and `togglePublish()` in the page |
| Insights tab | published/draft/with-image counts and audience mix |
| Student mobile feed | `apps/mobile/app/(tabs)/home.tsx` announcements section |
| Realtime refresh + deduplicated notifications | realtime provider + notification fan-out |

Announcements are **one-to-many news posts**. They are not calendar entries.

## Explicitly out of scope for this objective

- a separate `events` entity (title, description, starts_at, ends_at, venue,
  online link, capacity, status);
- RSVP/registration and capacity enforcement;
- attendance tracking or check-in;
- calendar view, recurrence, “add to calendar”, or event reminders;
- per-event analytics.

Building a half-implemented events module late in the project would add new
schema, RLS policies, web/mobile UI, and an E2E flow without enough time to
validate it. The honest alternative is to rename the objective and document the
boundary.

## How to present it

Use the renamed wording consistently in the manuscript, defense slides, and
demo script. If the panel asks about events, say:

> “We scoped this objective to announcement management. The system publishes
> targeted guidance announcements with drafts, images, realtime delivery, and
> insights. It does not implement event scheduling, RSVP, or attendance. Those
> were deliberately excluded so the delivered feature could be complete and
> tested rather than partially built.”

## If an events MVP is later required

The smallest defensible increment would be:

1. migration `00068_events.sql` with `events` and `event_rsvps`;
2. RLS: students read published events and manage their own RSVP; head/admin
   manage events; counselors read published events;
3. web head event create/edit list + student-facing event list;
4. mobile events list + RSVP;
5. E2E: head creates event → student RSVPs → head sees the count.

That is a separate, explicitly approved scope change — not part of P1.
