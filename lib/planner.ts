/**
 * The planning engine.
 *
 * This does not fill empty hours. Filling empty hours is what every calendar
 * app does and it is why nobody uses the output: you end up with a day that is
 * technically achievable and obviously fictional, and after three days of
 * missing it you stop opening the thing.
 *
 * It works in layers, and each layer may only use what the one above it left:
 *
 *   1. FIXED       sleep, races, gates at Aldershot, meetings, anything locked.
 *                  These are not negotiable and nothing else may touch them.
 *   2. REQUIRED    the work that genuinely has to happen today for the
 *                  deadlines to hold, plus the day's training. Computed from
 *                  the deadline arithmetic in work.ts, never invented.
 *   3. OPTIONAL    one high-value thing, chosen against the long-term goals,
 *                  and only when there is genuinely room for it.
 *
 * And then it stops. Whatever is left is free time, and free time is a feature
 * rather than a gap — it is marked explicitly, with a reason, so that it reads
 * as a decision and not as a planner that ran out of ideas.
 *
 * Two rules it will not break:
 *
 *   - It never changes the athlete's own time estimate on a job. If a build is
 *     four hours, it is four hours; the planner decides when, not how long.
 *   - It never schedules more work than the daily cap unless a deadline makes
 *     it unavoidable, and when it does, it says so out loud.
 */

import { addDays, daysBetween, dow } from './plan';
import { Span, findSpan, length, merge, subtract, toHHMM, toMin, hm, totalMinutes } from './clock';
import type { Job } from './work';
import type { Verdict } from './readiness';
import { SPA_WEEK, withinHours } from './spa';

/* -------------------------------------------------------------- types */

export type BlockKind =
  | 'sleep' | 'meal' | 'work' | 'own' | 'brand' | 'train' | 'ski' | 'golf'
  | 'recovery' | 'knee' | 'free' | 'social' | 'admin' | 'travel' | 'event';

export type Block = {
  start: number;
  end: number;
  kind: BlockKind;
  title: string;
  detail: string | null;
  /** The one line that answers "why this, now?" — §28. */
  why: string | null;
  jobId: number | null;
  eventId: number | null;
  goalId: number | null;
  locked: boolean;
  status: 'planned' | 'done' | 'skipped';
  /** False for anything the athlete put there by hand. */
  generated: boolean;
};

export type CalEvent = {
  id: number;
  day: string;
  end_day: string | null;
  start_at: string | null;
  end_at: string | null;
  title: string;
  kind: string;
  venue: string | null;
  notes: string | null;
  fixed: boolean;
  travel_min: number;
};

export type Commitment = {
  id: number;
  weekday: number;
  start_at: string;
  minutes: number;
  title: string;
  kind: string;
  travel_min: number;
  active: boolean;
  notes: string | null;
};

export type PlanSettings = {
  wake: string;
  bed: string;
  /** Hours of work a normal day owes. A target, not a block to be filled. */
  workDailyH: number;
  /** The point past which more work is a worse day, not a better one. */
  workCapH: number;
  /** Minutes of unstructured time the day must keep. */
  freeFloorMin: number;
  /** When the gym is open. Nothing that needs it gets placed outside. */
  gymOpen: string;
  gymClose: string;
};

export type BalanceSignal = {
  /** Minutes of work and training over the last seven days. */
  workMin7: number;
  trainMin7: number;
  freeMin7: number;
  /** Days since an evening that was genuinely social or free. */
  daysSinceSocial: number;
};

export type PlanInputs = {
  day: string;
  /** Minutes past midnight, when replanning part-way through a day. */
  now?: number | null;
  settings: PlanSettings;
  /** Actual wake time from the morning check-in, when it exists. */
  wakeActual?: string | null;
  readiness: Verdict | null;
  events: CalEvent[];
  commitments: Commitment[];
  /** Blocks the athlete locked or created. These survive replanning untouched. */
  keep: Block[];
  jobs: Job[];
  /** Today's gym prescription, if there is one. */
  training: { title: string; minutes: number; detail?: string } | null;
  kneeDone: boolean;
  balance: BalanceSignal;
  /** Goals, only so an optional block can name the one it serves. */
  goals: { id: number; title: string; area: string; status: string }[];
};

export type Unplaced = { job: Job; minutes: number; why: string };

export type DayPlan = {
  day: string;
  blocks: Block[];
  workMinutes: number;
  trainMinutes: number;
  freeMinutes: number;
  /** What is happening at `now`, and what is next. */
  current: Block | null;
  next: Block | null;
  notes: string[];
  unplaced: Unplaced[];
  /** Work that had to be scheduled beyond the daily cap, and why. */
  overCap: number;
};

/* --------------------------------------------------- required work today */

export type WorkDemand = {
  job: Job;
  /** Minutes of this job that genuinely belong to today. */
  today: number;
  reason: string;
};

/**
 * How much of each job has to happen today.
 *
 * The rule is deliberately simple, because a complicated one would be
 * unexplainable and the athlete would stop trusting it: take what is left,
 * divide it across the days still available before the deadline, and round to
 * a workable chunk. Four hours due Friday, three days left, means an hour and
 * a half tomorrow and the same again the day after — not four hours on
 * Thursday night.
 *
 * The estimate itself is never touched. That is the athlete's number.
 */
export function requiredToday(jobs: Job[], day: string, capMinutes: number): WorkDemand[] {
  const live = jobs.filter(
    (j) => (j.status === 'todo' || j.status === 'doing') && !j.waiting_on,
  );

  const demands: WorkDemand[] = [];

  for (const j of live) {
    const remaining = Math.max(0, j.est_min - j.logged_min);
    if (remaining <= 0) continue;
    if (!j.due) continue;                       // no deadline: optional layer only

    const daysLeft = daysBetween(day, j.due);

    if (daysLeft < 0) {
      demands.push({
        job: j,
        today: remaining,
        reason: `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}. All of it is today's problem now.`,
      });
      continue;
    }

    // Spread across today and every remaining day inclusive.
    const spread = daysLeft + 1;
    const share = Math.ceil(remaining / spread / 15) * 15;
    demands.push({
      job: j,
      today: Math.min(remaining, Math.max(15, share)),
      reason:
        spread === 1
          ? 'Due today.'
          : `${hm(remaining)} left over ${spread} days — this is today's share, not the whole job.`,
    });
  }

  // Deadline first, then the ones that unblock something, then value.
  demands.sort((a, b) => {
    const da = a.job.due ? daysBetween(day, a.job.due) : 999;
    const db = b.job.due ? daysBetween(day, b.job.due) : 999;
    if (da !== db) return da - db;
    if (!!a.job.unblocks !== !!b.job.unblocks) return a.job.unblocks ? -1 : 1;
    return (b.job.value_gbp ?? 0) - (a.job.value_gbp ?? 0);
  });

  // Trim to the cap, keeping the order. Anything that falls off is reported
  // rather than silently dropped.
  let used = 0;
  for (const d of demands) {
    if (used >= capMinutes) { d.today = 0; continue; }
    d.today = Math.min(d.today, capMinutes - used);
    used += d.today;
  }

  return demands.filter((d) => d.today > 0);
}

/* -------------------------------------------------------------- the plan */

/**
 * What a light day gets offered instead of a nameless work block.
 *
 * Every one of these serves a long-term goal, takes under an hour, and is the
 * sort of thing that never feels urgent and therefore never happens. That is
 * exactly why they belong on a day with room in it.
 */
const PROACTIVE: { title: string; kind: BlockKind; minutes: number; area: string; why: string }[] = [
  {
    title: 'Personal brand — make something', kind: 'brand', minutes: 60, area: 'brand',
    why: 'The slowest-compounding thing you do and the first to get dropped.',
  },
  {
    title: 'Prospecting — three real pitches', kind: 'own', minutes: 45, area: 'business',
    why: 'New clients are the only thing that actually moves monthly revenue, and they never arrive on a deadline.',
  },
  {
    title: 'Lyne MTB', kind: 'own', minutes: 60, area: 'life',
    why: 'It only ever gets the leftovers, so a day with leftovers is the day to give it some.',
  },
  {
    title: 'Admin — invoices and the inbox', kind: 'admin', minutes: 30, area: 'business',
    why: 'Half an hour now, or a bad hour on a day you cannot spare it.',
  },
  {
    title: 'Client follow-ups', kind: 'own', minutes: 30, area: 'business',
    why: 'The cheapest revenue there is. Existing clients answer faster than new ones.',
  },
  {
    title: 'Sharpen something', kind: 'own', minutes: 45, area: 'business',
    why: 'A tool, a workflow, a skill. The thing you keep saying you will get to.',
  },
];

const MEAL = { breakfast: 30, lunch: 45, dinner: 60 };
const WORK_CHUNK = 105;      // the longest useful single stretch
const WORK_MIN_CHUNK = 30;
const BREAK = 20;

function block(
  start: number, end: number, kind: BlockKind, title: string,
  extra: Partial<Block> = {},
): Block {
  return {
    start, end, kind, title,
    detail: null, why: null, jobId: null, eventId: null, goalId: null,
    locked: false, status: 'planned', generated: true,
    ...extra,
  };
}

export function buildDay(i: PlanInputs): DayPlan {
  const notes: string[] = [];
  const s = i.settings;

  const wake = toMin(i.wakeActual ?? s.wake, 450);
  const bed = toMin(s.bed, 1395);
  const dayWindow: Span = { start: wake, end: bed };
  // Anything needing the building has a narrower window than the day does.
  const gymOpen = toMin(s.gymOpen, 6 * 60);
  const gymClose = toMin(s.gymClose, 22 * 60);
  const gymWindow: Span = { start: Math.max(wake, gymOpen), end: Math.min(bed, gymClose) };
  const weekday = dow(i.day);
  const isWorkday = weekday >= 1 && weekday <= 5;

  if (i.wakeActual && Math.abs(toMin(i.wakeActual) - toMin(s.wake)) >= 45) {
    const late = toMin(i.wakeActual) > toMin(s.wake);
    notes.push(
      late
        ? `Up at ${toHHMM(toMin(i.wakeActual))} rather than ${s.wake}, so the day has ${hm(toMin(i.wakeActual) - toMin(s.wake))} less in it. Everything below has been recut around that rather than pretending you can still do all of it.`
        : `Up at ${toHHMM(toMin(i.wakeActual))} — ${hm(toMin(s.wake) - toMin(i.wakeActual))} more than usual, and it has gone into the day rather than into extra work.`,
    );
  }

  /* ---------------------------------------------- layer 1: fixed things */

  const placed: Block[] = [];

  // Anything the athlete locked, moved, finished or skipped wins over everything.
  for (const k of i.keep) placed.push({ ...k, locked: true });

  /**
   * What the kept blocks already account for.
   *
   * This is the part that was missing, and it was the whole of the "it just
   * adds it again" bug. A kept block used to occupy time without SATISFYING
   * anything: you marked the morning's RPM done, the planner still believed it
   * owed seven hours of RPM, and it dutifully found somewhere else in the day
   * to put them. From the outside that looks exactly like the button not
   * working.
   *
   * Done and skipped both count as settled for today. They mean different
   * things tomorrow — a skipped job still owes its time, and the deadline
   * arithmetic rolls it forward on its own — but neither should be put back on
   * today's page after you have just dealt with it.
   */
  const settled = {
    minutesFor: (pred: (b: Block) => boolean) =>
      placed.filter(pred).reduce((a, b) => a + (b.end - b.start), 0),
    hasKind: (k: BlockKind) => placed.some((b) => b.kind === k),
    hasTitle: (t: string) => placed.some((b) => b.title === t),
    forJob: (id: number) => placed.filter((b) => b.jobId === id).reduce((a, b) => a + (b.end - b.start), 0),
  };

  for (const e of i.events) {
    if (!e.fixed) continue;

    // An all-day event is not a twenty-four-hour event. A race weekend does own
    // the day, but you still eat three times and the evening is still yours —
    // blocking wake to bed produced a timetable with no meals, no recovery and
    // no free time, which is not what a race day looks like and is not usable.
    const allDay = !e.start_at;
    const span = allDayWindow(e.kind);
    const start = allDay ? Math.max(wake, span.start) : toMin(e.start_at);
    const end = allDay ? Math.min(bed, span.end) : toMin(e.end_at, start + 90);
    if (allDay) {
      notes.push(
        `${e.title} owns today. The plan keeps meals, recovery and the evening around it rather than blanking the whole day, but nothing else is scheduled — and that is right.`,
      );
    }
    if (placed.some((p) => p.eventId === e.id)) continue;
    if (e.travel_min > 0) {
      placed.push(block(start - e.travel_min, start, 'travel', `Travel — ${e.title}`, {
        eventId: e.id,
        why: `${hm(e.travel_min)} each way. It is part of the commitment, so it is on the plan rather than a surprise.`,
      }));
      placed.push(block(end, end + e.travel_min, 'travel', `Travel home — ${e.title}`, { eventId: e.id }));
    }
    if (allDay && end <= start) {
      // A deadline is a date, not an appointment. It shapes the work that has
      // to happen today; it does not occupy hours of its own.
      notes.push(`${e.title} is due today.`);
      continue;
    }
    placed.push(block(start, Math.max(end, start + 30), kindOf(e.kind), e.title, {
      eventId: e.id,
      detail: e.venue,
      why: e.notes,
    }));
  }

  for (const c of i.commitments) {
    if (!c.active || c.weekday !== weekday) continue;
    const start = toMin(c.start_at);
    const end = start + c.minutes;
    if (placed.some((p) => p.title === c.title)) continue;
    if (c.travel_min > 0) {
      placed.push(block(start - c.travel_min, start, 'travel', `Travel — ${c.title}`, {
        why: `${hm(c.travel_min)} each way, every week. Building the day around it is the only way it works.`,
      }));
      placed.push(block(end, end + c.travel_min, 'travel', `Travel home — ${c.title}`));
    }
    placed.push(block(start, end, kindOf(c.kind), c.title, { detail: c.notes, why: c.notes }));
  }

  /* ---------------------------------------------------- anchors: eating */

  /**
   * Place something near a time it wants to be at — and refuse to place it at
   * all if the nearest gap is hours away.
   *
   * Without the tolerance, a race that runs 08:00 to 18:00 pushed breakfast to
   * six in the evening, because the first free span after the wanted time was
   * the only one there was. A plan that says "breakfast, 18:00" is not slightly
   * wrong, it is obviously wrong, and one line like that costs the whole page
   * its credibility.
   */
  const anchor = (
    want: number, len: number, minLen: number, tolerance: number,
    kind: BlockKind, title: string, why: string | null,
  ) => {
    if (settled.hasTitle(title)) return;
    const free = subtract(dayWindow, placed, Math.min(15, minLen));
    const near = free.filter((f) => f.end > want - tolerance && f.start < want + tolerance);
    const spot = findSpan(near, len, want) ?? findSpan(near, minLen, want);
    if (!spot) {
      notes.push(`No room for ${title.toLowerCase()} anywhere near its usual time today. Eat when you can — the plan is not going to pretend otherwise.`);
      return;
    }
    const use = Math.min(len, length(spot));
    const start = Math.max(spot.start, Math.min(want, spot.end - use));
    placed.push(block(start, start + use, kind, title, { why }));
  };

  anchor(wake + 30, MEAL.breakfast, 20, 3 * 60, 'meal', 'Breakfast',
    'Thirty minutes after waking, so it is eaten rather than skipped on the way out.');
  anchor(toMin('13:00'), MEAL.lunch, 25, 3 * 60, 'meal', 'Lunch',
    'A real break away from the desk. The afternoon is worse without it, every time.');
  anchor(toMin('19:00'), MEAL.dinner, 30, 3 * 60, 'meal', 'Dinner', null);

  /* ---------------------------------------------- layer 2: the training */

  let trainMinutes = 0;
  const band = i.readiness?.band ?? null;

  const trainingSettled = settled.hasKind('train') || settled.hasKind('recovery');
  if (trainingSettled) {
    trainMinutes = settled.minutesFor((b) => b.kind === 'train');
  } else if (i.training && band !== 'red') {
    const free = subtract(gymWindow, placed, 20);
    // Afternoon by preference — far enough from breakfast to have digested,
    // early enough that it is not competing with the evening.
    const spot = findSpan(free, i.training.minutes, toMin('14:00'));
    if (spot) {
      const start = Math.max(spot.start, Math.min(toMin('13:45'), spot.end - i.training.minutes));
      placed.push(block(start, start + i.training.minutes, 'train', i.training.title, {
        detail: i.training.detail ?? null,
        why:
          band === 'amber'
            ? 'Readiness is middling, so every movement stays and the top set comes off. Trimming a session beats missing it.'
            : 'Readiness is good and this is the session the block is built on.',
      }));
      trainMinutes = i.training.minutes;
    } else {
      notes.push(
        `${i.training.title} could not be placed between ${s.gymOpen} and ${s.gymClose} without clashing with something fixed. Move a commitment or accept it slides — the plan will not pretend you trained in a closed gym.`,
      );
    }
  } else if (i.training && band === 'red' && !trainingSettled) {
    const free = subtract(dayWindow, placed, 20);
    const spot = findSpan(free, 40, toMin('18:00'));
    if (spot) {
      placed.push(block(spot.start, spot.start + 40, 'recovery', 'Recovery — walk, mobility, sauna', {
        why: `Readiness came back red, so ${i.training.title.toLowerCase()} is off. Choosing recovery on a red day is a good day, not a missed one — the score below treats it that way.`,
      }));
    }
    notes.push('Training is deliberately not on today. That is the plan working, not the plan failing.');
  }

  if (!i.kneeDone && !settled.hasKind('knee')) {
    anchor(toMin('20:30'), 10, 10, 5 * 60, 'knee', 'Knee 10',
      'Ten minutes, every day, for the rest of the build. It is the cheapest thing on this page and the one that protects everything else.');
  }

  /* --------------------------------------- the spa, on the days it belongs */

  // Placed here rather than left to the free-time layer because WHEN it happens
  // is the entire point: cold within six hours of lifting costs you the session.
  for (const raw of SPA_WEEK) {
    if (raw.weekday !== weekday) continue;
    if (settled.hasKind('recovery')) break;
    const slot = withinHours(raw, gymOpen, gymClose);
    if (!slot) continue;
    const want = toMin(slot.at);
    const free = subtract(gymWindow, placed, 15);
    const near = free.filter((f) => f.end > want - 120 && f.start < want + 120);
    const spot = findSpan(near, slot.minutes, want) ?? findSpan(near, 15, want);
    if (!spot) continue;
    const use = Math.min(slot.minutes, length(spot));
    const start = Math.max(spot.start, Math.min(want, spot.end - use));
    placed.push(block(start, start + use, 'recovery', slot.title, { why: slot.why }));
  }

  /* ------------------------------------------------- layer 2: the work */

  // A race day is not a work evening, and neither is the one before it. This is
  // the whole reason the two halves of this app live together: it already knows
  // you are at Llandudno on Saturday, so it does not schedule a build for that
  // night and then mark it missed.
  const raceToday = i.events.some((e) => e.kind === 'race' && e.fixed)
    || placed.some((b) => b.kind === 'ski' && b.end - b.start >= 4 * 60);

  const capMinutes = raceToday ? 0 : Math.round(s.workCapH * 60);
  const targetMinutes = isWorkday && !raceToday ? Math.round(s.workDailyH * 60) : 0;
  const ownDemands = requiredToday(i.jobs, i.day, capMinutes);

  if (raceToday) {
    const owed = requiredToday(i.jobs, i.day, 10 * 60);
    if (owed.length) {
      notes.push(
        `${owed.length} job${owed.length === 1 ? '' : 's'} would normally have had time today — ${owed.map((d) => d.job.title).join(', ')}. Racing takes the day, so that work has moved rather than being quietly missed. Check the deadlines before Monday.`,
      );
    }
  }

  const workQueue: { minutes: number; title: string; kind: BlockKind; job?: Job; why: string }[] = [];

  /**
   * Real work first, always.
   *
   * There used to be a generic "RPM" block that appeared every weekday whether
   * or not there was anything in it. That is the shape of a timetable, not a
   * plan: it told you to work for seven hours without ever saying on what, and
   * a block with no content in it is a block you learn to ignore.
   *
   * So the day is built from actual jobs with actual deadlines. If those do not
   * fill the target, the gap is NOT padded with a nameless work block — it gets
   * offered to the proactive list below, or it stays free.
   */
  for (const d of ownDemands) {
    const already = settled.forJob(d.job.id);
    const left = Math.max(0, d.today - already);
    if (left < WORK_MIN_CHUNK) continue;
    workQueue.push({
      minutes: left,
      title: d.job.client ? `${d.job.title} — ${d.job.client}` : d.job.title,
      kind: 'own',
      job: d.job,
      why: already > 0 ? `${hm(already)} already down today. ${d.reason}` : d.reason,
    });
  }

  /* --------------------------------------- the light day: be proactive */

  const committedMinutes =
    workQueue.reduce((a, x) => a + x.minutes, 0)
    + settled.minutesFor((b) => b.kind === 'work' || b.kind === 'own' || b.kind === 'brand');

  const shortfall = Math.max(0, targetMinutes - committedMinutes);

  if (shortfall >= 45 && !raceToday) {
    // Rotate the offer by the date so it is not the same suggestion every day,
    // and take at most two. A list of six things to "be proactive" about is a
    // list nobody reads.
    const seed = Math.floor(new Date(i.day + 'T12:00:00Z').getTime() / 86_400_000);
    const pool = PROACTIVE.filter((x) => !settled.hasTitle(x.title));
    let offered = 0;
    let room = Math.min(shortfall, 150);
    for (let n = 0; n < pool.length && offered < 2 && room >= 30; n++) {
      const x = pool[(seed + n) % pool.length];
      if (x.minutes > room) continue;
      const goal = i.goals.find((g) => g.area === x.area && g.status === 'active');
      workQueue.push({
        minutes: x.minutes,
        title: x.title,
        kind: x.kind,
        why: goal
          ? `${x.why} Nothing urgent is due today, and this is the only thing on the page that moves "${goal.title}".`
          : `${x.why} Nothing urgent is due today.`,
      });
      room -= x.minutes;
      offered++;
    }
    if (offered > 0) {
      notes.push(
        `Only ${hm(committedMinutes)} of work genuinely has to happen today against a ${hm(targetMinutes)} target. The rest has not been padded out with a nameless block — it is offered to ${offered === 1 ? 'one proactive thing' : 'two proactive things'}, and whatever you do not take stays free.`,
      );
    }
  }

  let workMinutes = 0;
  const unplaced: Unplaced[] = [];

  for (const item of workQueue) {
    let left = item.minutes;
    let guard = 0;
    while (left >= WORK_MIN_CHUNK && guard++ < 12) {
      const free = subtract(dayWindow, placed, WORK_MIN_CHUNK);
      // Morning first: it is the only part of the day nothing else competes for.
      const want = Math.min(left, WORK_CHUNK);
      const spot = findSpan(free, want, wake + 90);
      if (!spot) break;
      const chunk = Math.min(want, length(spot));
      placed.push(block(spot.start, spot.start + chunk, item.kind, item.title, {
        jobId: item.job?.id ?? null,
        why: item.why,
      }));
      workMinutes += chunk;
      left -= chunk;
      // A break after a long stretch, so the next block does not butt against it.
      if (left >= WORK_MIN_CHUNK) {
        const bstart = spot.start + chunk;
        if (bstart + BREAK <= spot.end) {
          placed.push(block(bstart, bstart + BREAK, 'free', 'Break', {
            why: 'Twenty minutes away from a screen. Two hours straight is not twice as productive as one.',
          }));
        }
      }
    }
    if (left >= WORK_MIN_CHUNK) {
      if (item.job) {
        unplaced.push({
          job: item.job,
          minutes: left,
          why: `${hm(left)} of this would not fit today. ${item.job.due ? `It is due ${item.job.due}.` : ''} Either it moves to tomorrow or something else does.`,
        });
      } else {
        notes.push(`${hm(left)} of the RPM budget would not fit around today's commitments. That is worth knowing now rather than at six o'clock.`);
      }
    }
  }

  // Say out loud what a skip did. "It rescheduled" is invisible otherwise —
  // the work simply reappears tomorrow with no explanation, which reads like
  // the app forgot rather than like it handled it.
  const skipped = placed.filter((b) => b.status === 'skipped');
  for (const sk of skipped) {
    const job = sk.jobId ? i.jobs.find((j) => j.id === sk.jobId) : null;
    if (job?.due) {
      const left = daysBetween(i.day, job.due);
      notes.push(
        left > 0
          ? `${job.title} skipped today. The ${hm(Math.max(0, job.est_min - job.logged_min))} still to do now spreads over ${left} day${left === 1 ? '' : 's'} instead of ${left + 1}, so tomorrow's share goes up — nothing has been lost, and the deadline has not moved.`
          : `${job.title} skipped, and it is due today. That is now overdue, and tomorrow it will be at the top of the list whatever else is on.`,
      );
    } else if (sk.title === 'RPM') {
      notes.push(
        `${hm(sk.end - sk.start)} of RPM skipped. The budget resets tomorrow rather than carrying a debt — but two or three of these in a week is the thing to notice, not any one of them.`,
      );
    }
  }

  const overCap = Math.max(0, workMinutes - capMinutes);
  if (overCap > 0) {
    notes.push(
      `${hm(workMinutes)} of work today, over your ${s.workCapH} h line by ${hm(overCap)}. A deadline forced it. One day like this is fine; three in a row is a scheduling problem, not a work ethic.`,
    );
  }

  /* ------------------------------------------- layer 3: one optional thing */

  const freeNow = subtract(dayWindow, placed, 30);
  const freeMinutesBefore = totalMinutes(freeNow);

  if (freeMinutesBefore > s.freeFloorMin + 45) {
    const social = i.balance.daysSinceSocial >= 6
      || (i.balance.workMin7 + i.balance.trainMin7 > 50 * 60 && i.balance.freeMin7 < 10 * 60);

    if (social) {
      const spot = findSpan(freeNow, 90, toMin('19:30'));
      if (spot) {
        const start = Math.max(spot.start, Math.min(toMin('19:30'), spot.end - 90));
        const load = i.balance.workMin7 + i.balance.trainMin7;
        placed.push(block(start, start + 90, 'social', 'See people', {
          why: load > 60
            ? `${i.balance.daysSinceSocial} days since an evening that was actually yours, on top of ${hm(load)} of work and training this week. This is a suggestion, not an instruction — but it is the right one.`
            : 'There is real room tonight and nothing that has to go in it. Seeing people is a legitimate use of an evening, and it is the first thing that quietly disappears from a year like this one.',
        }));
      }
    }
    // The proactive layer above already offers the useful optional work, so
    // there is deliberately nothing else here. What is left stays free.
  }

  /* --------------------------------------------- what is left is free time */

  const gaps = subtract(dayWindow, placed, 45);
  for (const g of gaps) {
    placed.push(block(g.start, g.end, 'free', 'Free', {
      why: 'Deliberately empty. The plan is not short of ideas — it is short of reasons to fill this, and unstructured time is what makes the rest of it sustainable.',
    }));
  }

  // Wind-down and sleep close the day.
  placed.push(block(bed, bed + 15, 'sleep', 'Lights out', {
    why: `${hm(((wake + 24 * 60) - bed) % (24 * 60))} to the alarm.`,
  }));

  placed.sort((a, b) => a.start - b.start || a.end - b.end);

  /* ------------------------------------------------------ now and next */

  const nowMin = i.now ?? null;
  const current = nowMin == null ? null : placed.find((b) => b.start <= nowMin && b.end > nowMin) ?? null;
  const next = nowMin == null
    ? placed.find((b) => b.kind !== 'sleep') ?? null
    : placed.find((b) => b.start > nowMin && b.kind !== 'free') ?? null;

  const freeMinutes = totalMinutes(merge(placed.filter((b) => b.kind === 'free').map((b) => ({ start: b.start, end: b.end }))));

  if (freeMinutes < s.freeFloorMin && overCap === 0) {
    notes.push(
      `Only ${hm(freeMinutes)} of unstructured time today against a ${hm(s.freeFloorMin)} floor. Nothing here is wrong, but a week of days like this is how the wheels come off.`,
    );
  }

  if (!workQueue.length) {
    notes.push('No work scheduled, because there is none that has to happen today. That is a real answer — the planner does not invent work to look busy.');
  }

  return {
    day: i.day,
    blocks: placed,
    workMinutes,
    trainMinutes,
    freeMinutes,
    current,
    next,
    notes,
    unplaced,
    overCap,
  };
}

/**
 * The working window an all-day event actually occupies.
 *
 * A race day starts early and finishes when you have driven home. A holiday
 * genuinely is the whole day. A deadline occupies no time at all — it is a
 * date, not an appointment, and blocking hours for one is how a calendar
 * quietly eats a week.
 */
function allDayWindow(kind: string): Span {
  switch (kind) {
    case 'race': return { start: 8 * 60, end: 18 * 60 };
    case 'ski': return { start: 9 * 60, end: 17 * 60 };
    case 'travel': return { start: 9 * 60, end: 18 * 60 };
    case 'holiday': return { start: 0, end: 24 * 60 };
    case 'deadline': return { start: 0, end: 0 };
    default: return { start: 9 * 60, end: 17 * 60 };
  }
}

function kindOf(k: string): BlockKind {
  const map: Record<string, BlockKind> = {
    race: 'ski', ski: 'ski', gym: 'train', golf: 'golf', work: 'work',
    meeting: 'work', deadline: 'admin', travel: 'travel', social: 'social',
    appointment: 'event', holiday: 'free', admin: 'admin', event: 'event',
  };
  return map[k] ?? 'event';
}

/* ------------------------------------------------------- what now, and why */

export type NowCard = {
  when: string;
  title: string;
  kind: BlockKind;
  why: string;
  /** The thing after it, so the screen can say what is coming. */
  thenAt: string | null;
  thenTitle: string | null;
};

export function nowCard(p: DayPlan, now: number): NowCard | null {
  const b = p.current ?? p.blocks.find((x) => x.start > now && x.kind !== 'free') ?? null;
  if (!b) return null;
  const after = p.blocks.find((x) => x.start >= b.end && x.kind !== 'free' && x.kind !== 'sleep') ?? null;
  return {
    when: `${toHHMM(b.start)}–${toHHMM(b.end)}`,
    title: b.title,
    kind: b.kind,
    why: b.why ?? 'It is what the day has room for.',
    thenAt: after ? toHHMM(after.start) : null,
    thenTitle: after ? after.title : null,
  };
}

/** Minutes spent on each kind, for the day summary and the score. */
export function tally(p: DayPlan): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of p.blocks) {
    if (b.kind === 'sleep') continue;
    out[b.kind] = (out[b.kind] ?? 0) + (b.end - b.start);
  }
  return out;
}

export { addDays };
