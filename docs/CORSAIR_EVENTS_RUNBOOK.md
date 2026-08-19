# Corsair Tactical Solutions — Events Runbook

**Last updated:** August 2026  
**Corsair Convex site ID:** `qd7cpjk68m0z4rme5hw4sqgeys8bk1zc`  
**Corsair GitHub repo:** `thefsts/Corsair-Tactical-Solutions`

---

## Why this runbook exists

Corsair's events appear in two places that **must stay in sync**:

| Source | What it powers |
|--------|---------------|
| `convex/seedCorsair.ts` → `seedEvents` mutation | FSTS dashboard registration, seat counts, booking forms |
| `src/data/events.ts` in `thefsts/Corsair-Tactical-Solutions` | Corsair website events page listing |

If you add an event to only one source, the website shows it but the booking form breaks (or vice versa).

---

## Checklist: Adding a new Corsair class session

### Step 1 — Decide the session details

Gather before you start:

- **Date(s)** — single day for LTC/Level II; 4-day Mon–Thu for Level III/IV
- **Time** — LTC: 9 AM–5 PM CT; Level II: 8 AM–5 PM CT; Level III/IV: 8 AM–6 PM CT
- **Location** — Farmers Branch, TX (LTC) or Dallas, TX (security training)
- **Course slug** — must match exactly:
  - Texas LTC: `texas-ltc-certification-basic-handgun`
  - Level II Unarmed: `level-2-security-officer`
  - Level III/IV combined: `level-3-4-complete-package`
- **Price** — LTC $100 (10000 cents); Level II $65 (6500 cents); Level III/IV $400 (40000 cents)
- **Capacity** — LTC/Level II: 20 seats, 5 waitlist; Level III/IV: 15 seats, 5 waitlist

### Step 2 — Pick the correct UTC offset

Central Time observes DST:
- **CDT (UTC-5):** 2nd Sunday of March → 1st Sunday of November
- **CST (UTC-6):** 1st Sunday of November → 2nd Sunday of March

Quick reference for upcoming transitions:
- 2026: CDT ends Nov 1 → CST begins Nov 2, 2026
- 2027: CST ends Mar 14 → CDT begins Mar 14, 2027 at 2:00 AM

### Step 3 — Update `convex/seedCorsair.ts`

Open `convex/seedCorsair.ts` and find the `seedEvents` mutation (~line 873). Add a new block to the `events` array **before the closing `];`**, following the existing pattern:

```ts
{
  title: "Texas LTC Certification Class — <Month> <Year>",
  slug: "texas-ltc-certification-class-<mon><year>",   // e.g. "texas-ltc-certification-class-apr2027"
  status: "published",
  isPublished: true,
  lifecycleStatus: "open",
  registrationStatus: "open",
  description: "Texas License to Carry certification — <Month> <Year> session. ...",
  startAt: ctMs("YYYY-MM-DD", 9, "CDT"),    // or "CST" for winter months
  endAt:   ctMs("YYYY-MM-DD", 17, "CDT"),
  startDateTime: ctMs("YYYY-MM-DD", 9, "CDT"),
  endDateTime:   ctMs("YYYY-MM-DD", 17, "CDT"),
  location: "Farmers Branch, TX",
  courseSlug: "texas-ltc-certification-basic-handgun",
  priceCents: 10000,
  capacity: 20,
  waitlistCapacity: 5,
  timezone: "America/Chicago",
  registrationOpenAt:  ctMs("YYYY-MM-DD", 0, "CDT"),   // ~6 weeks before class
  registrationCloseAt: ctMs("YYYY-MM-DD", 17, "CDT"),  // day before class at 5 PM
  autoCloseRegistration: true,
  autoArchive: true,
  imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
},
```

**Slug naming convention:** `<course-abbrev>-<mon><year>` where mon is 3-letter lowercase, e.g.:
- `texas-ltc-certification-class-apr2027`
- `level-2-security-officer-apr2027`
- `level-iii-iv-security-training-apr2027`

### Step 4 — Update `src/data/events.ts` in the Corsair website repo

Push the new event(s) to `thefsts/Corsair-Tactical-Solutions` via the GitHub API using the blob→tree→commit→PATCH pattern (see `.agents/memory/corsair-push.md` for the full pattern).

Add the new event block **inside the `const EVENTS: CorsairEvent[]` array**, before the `// ── Past events` comment, following the existing structure:

```ts
{
  id: 'evt-ltc-apr2027',               // unique ID
  paymentMode: 'online',
  courseSlug: 'texas-ltc-certification-basic-handgun',
  slug: 'texas-ltc-certification-class-apr2027',
  title: 'Texas LTC Certification Class — April 2027',
  date: '2027-04-19',                  // ISO date — drives upcoming/past filtering
  dateDisplay: 'April 19, 2027',
  time: '9:00 AM – 5:00 PM CT',
  location: 'Farmers Branch, TX',
  category: 'LTC Certification',
  shortDescription:
    'Texas LTC classroom and range qualification — April 2027 session.',
  description:
    'Complete your Texas License to Carry certification in a one-day course covering all state requirements, written exam, and live-fire qualification. All skill levels welcome.',
  heroImage: '/images/corsair-real/ltc-shooting-proficiency-01.png',
  seatsTotal: 20,
  seatsAvailable: 20,
},
```

For a **past** event, also add `isPast: true` and set `seatsAvailable: 0`.

For **security training** events, use:
- `heroImage: '/images/corsair-real/level-3-armed-security-01.jpg'`
- `category: 'Security Training'`
- For Level III/IV multi-day events, `dateDisplay: 'November 10–13, 2026'`

### Step 5 — Re-run the Convex seedEvents mutation

After editing `convex/seedCorsair.ts`, run:

```bash
npx convex run seedCorsair:seedEvents '{"siteId":"qd7cpjk68m0z4rme5hw4sqgeys8bk1zc"}'
```

> ⚠️ `seedEvents` **deletes all existing event records for the site** before reinserting.  
> Any dashboard-created events not reflected in `seedCorsair.ts` will be lost.  
> Always add new sessions to `seedCorsair.ts` first — it is the source of truth.

### Step 6 — Verify

1. Check Convex dashboard → Events for the Corsair site — new records should appear.
2. Visit `https://corsairtacticalsolutions.com/events` — upcoming sessions should appear in the listing.
3. Click through to a new event and confirm the booking form loads (not "Call to Register").
4. The seat counter on the events page should show the correct total seats.

---

## Scheduled sessions (as of August 2026)

| Date | Session | Slug |
|------|---------|------|
| Aug 23, 2026 | Level II Unarmed Security | `level-2-security-officer-aug2026` |
| Aug 30, 2026 | Texas LTC | `texas-ltc-certification-class-aug2026` |
| Sep 13–16, 2026 | Level III/IV Security | `level-iii-iv-security-training-sep2026` |
| Sep 27, 2026 | Texas LTC | `texas-ltc-certification-class-sep2026` |
| Oct 18, 2026 | Texas LTC | `texas-ltc-certification-class-oct2026` |
| Nov 8, 2026 | Level II Unarmed Security | `level-2-security-officer-nov2026` |
| Nov 10–13, 2026 | Level III/IV Security | `level-iii-iv-security-training-nov2026` |
| Nov 15, 2026 | Texas LTC | `texas-ltc-certification-class-nov2026` |
| Jan 10, 2027 | Level II Unarmed Security | `level-2-security-officer-jan2027` |
| Jan 17, 2027 | Texas LTC | `texas-ltc-certification-class-jan2027` |
| Feb 9–12, 2027 | Level III/IV Security | `level-iii-iv-security-training-feb2027` |
| Feb 21, 2027 | Texas LTC | `texas-ltc-certification-class-feb2027` |
| Mar 8, 2027 | Level II Unarmed Security | `level-2-security-officer-mar2027` |
| Mar 22, 2027 | Texas LTC | `texas-ltc-certification-class-mar2027` |

---

## Suggested cadence

- **Monthly:** Add the next 2–3 months of sessions whenever the events page drops below 3 upcoming events.
- **Quarterly:** Schedule a full quarter of sessions in advance so students can plan.
- **When a session sells out:** Convex `autoCloseRegistration` closes registration automatically. Consider adding a second session the same month.

---

## Image URLs reference

| Use | URL |
|-----|-----|
| LTC / firearms events | `https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg` |
| Level II security | `https://storage.googleapis.com/corsair-tactical/event-aug-level2.jpg` |
| Level III/IV security | `https://storage.googleapis.com/corsair-tactical/event-sep-level34.jpg` |
| Website hero (LTC) | `/images/corsair-real/ltc-shooting-proficiency-01.png` |
| Website hero (security) | `/images/corsair-real/level-3-armed-security-01.jpg` |
