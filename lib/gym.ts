/**
 * The five-day split, built for a slalom skier rather than for a mirror.
 *
 * Two rules govern everything here.
 *
 * The first: every single-leg exercise starts with the LEFT leg, and the right
 * never gets more reps than the left managed. It closes asymmetry faster than
 * any exercise selection, and it stops you quietly training the gap wider for
 * eleven months.
 *
 * The second is newer, and it came out of actually looking at the numbers.
 * A 50 kg RDL and a 25 kg single-leg press at 70 kg bodyweight is not a
 * rate-of-force-development problem, it is a strength problem — and you cannot
 * express force you have not got. So until Christmas this is a strength
 * programme wearing a slalom coat: heavy, simple, progressive, and it happens
 * to build the physique at the same time because at this training age those are
 * the same programme. The conversion to power belongs in Block 6, once there is
 * something to convert.
 *
 * The other structural change: slalom is a frontal-plane sport and almost every
 * gym programme is sagittal. Thursday now exists to fix that.
 *
 * Every load below is a real starting number derived from lifts actually
 * logged, not a percentage of a one-rep max nobody has tested. A percentage of
 * an unknown is not a prescription.
 */

import { Block, blockFor, isRaceWeek, dow } from './plan';
import { LADDER, Rung } from './knee';

export const LEFT_FIRST_RULE =
  'Every single-leg exercise starts with the left leg. The right never gets more reps than the left managed. Load only rises when both sides clear the target.';

export const PROGRESSION_RULE =
  'If every set hit its target reps with a rep or two still in the tank, add load next week. Trap bar goes up 2.5 kg a week for as long as it keeps moving. Everything else goes up when it gets easy, not on a schedule.';

export type Exercise = {
  name: string;
  sets: string;
  note: string;
  /** Left leg leads. */
  left?: boolean;
  /** A compound whose prescription comes from the block. */
  compound?: boolean;
  /** Physique / isolation work — this is what the later blocks trim. */
  iso?: boolean;
  /** The plyometric block, filled from the current rung. */
  plyo?: boolean;
  /** Where to start, in kilograms, from lifts already logged. */
  start?: string;
  /** How this one moves up. */
  progress?: string;
};

export type GymDay = {
  n: 1 | 2 | 3 | 4 | 5;
  key: 'lowerA' | 'push' | 'cond' | 'lowerB' | 'pull';
  /** 1 = Mon … 7 = Sun */
  weekday: number;
  time: string;
  title: string;
  subtitle: string;
  minutes: number;
  warmup: string | null;
  exercises: Exercise[];
  tail: string | null;
};

export const DAYS: GymDay[] = [
  {
    n: 1, key: 'lowerA', weekday: 1, time: '08:15', title: 'Lower Strength', subtitle: 'The heaviest day of the week', minutes: 60,
    warmup: 'Bike 5 min, ankle dorsiflexion, 90/90 hip rotations, glute bridge ×15, Spanish squat 2×30 s. Low shear, high quad activation — what wakes a reconstructed knee before you load it.',
    exercises: [
      {
        name: 'Trap bar deadlift', sets: '4×6', compound: true,
        start: '50 kg for the first fortnight',
        progress: '+2.5 kg a week for as long as it keeps moving',
        note: 'The primary lift of the whole programme, and the one that changes your start more than anything else in this building. You have not used a bar recently, so the first two weeks are technique at a weight that feels too light — flat back, bar path straight up, hips and shoulders rising together. Then it climbs every single week.',
      },
      {
        name: 'Bulgarian split squat', sets: '3×8 / leg', left: true,
        start: '8 kg each hand — what you did today',
        progress: '+2 kg each hand once both legs clear 3×8 cleanly',
        note: 'If I could give a slalom skier one exercise this is it. It loads one leg through the range you actually ski in, and it exposes asymmetry honestly rather than letting the strong side cover. Left leg first, always, and the right gets whatever the left managed.',
      },
      {
        name: 'Barbell hip thrust', sets: '3×8', compound: true,
        start: '50 kg',
        progress: '+5 kg a week — this one climbs fast early',
        note: 'New to the plan, and the gap it fills is your start. A dryslope start is hip extension and poling, and you had no direct hip extension work at all. Chin tucked, ribs down, two-second squeeze at the top.',
      },
      {
        name: 'Nordic hamstring curl', sets: '3×5',
        start: 'Band-assisted',
        progress: 'Less band, then slower, then unassisted. Do not rush this one',
        note: 'Hamstring eccentric strength is the direct defence against the force that took your ACL. Earn it slowly — there is no prize for doing these unassisted in October.',
      },
      {
        name: 'Seated calf raise', sets: '3×12', iso: true,
        start: '30 kg', progress: '+2.5 kg when 3×12 is comfortable',
        note: 'Seated deliberately: it targets soleus, which resists the anterior shear the graft takes, and soleus stiffness is most of how quickly you can change edge.',
      },
      {
        name: 'Copenhagen adductor', sets: '3×8 / side',
        start: 'Short lever — knee on the bench',
        progress: 'Lengthen the lever before adding anything else',
        note: 'Adductor strength protects the meniscus repair under lateral load, and slalom is nothing but lateral load. Chronically neglected and it shows up as the thing that goes at the end of a long day.',
      },
      { name: 'Deadbug', sets: '3×10', note: 'Slow, ribs down. Superset with the Copenhagens to save the clock.' },
    ],
    tail: 'Furthest point from Wednesday gates and freshest from the weekend, so this is where the heavy work lives. Warm up longer than feels necessary. Eat inside 45 minutes of racking the bar.',
  },
  {
    n: 2, key: 'push', weekday: 2, time: '08:15', title: 'Push & Trunk', subtitle: 'Zero leg load — gates tomorrow', minutes: 55,
    warmup: null,
    exercises: [
      {
        name: 'Incline DB press', sets: '4×8', compound: true,
        start: '16 kg each hand', progress: '+2 kg each hand when 4×8 is clean',
        note: 'Upper chest fills the top of a t-shirt and it is shoulder-friendly.',
      },
      {
        name: 'Pec deck or flat machine press', sets: '3×10', compound: true,
        start: '50 kg', progress: '+2.5 kg when 3×10 is comfortable',
        note: 'Your logged 57.5 kg for 8 is a near-max. Work at 50 for tens — you want tissue here, not a PB.',
      },
      {
        name: 'Lateral raise', sets: '4×15', iso: true,
        start: '6 kg each hand', progress: 'Reps before load. Strict beats heavy every time',
        note: 'Highest visual return of anything in this session. No swinging — momentum means you are training traps instead.',
      },
      {
        name: 'Cable pushdown', sets: '3×12', iso: true,
        start: '20 kg', progress: '+2.5 kg when 3×12 is easy',
        note: 'Twelves. Eight reps on a triceps isolation leaves growth on the table for no strength benefit.',
      },
      { name: 'Overhead extension', sets: '3×12', iso: true, start: '12 kg', note: 'Long head — the bit that makes an arm look full from the side.' },
      { name: 'Pallof press', sets: '3×12 / side', start: '15 kg', note: 'The trunk stiffness that stops your upper body unwinding out of a turn.' },
      {
        name: 'Suitcase carry', sets: '3×30 m / side', left: true,
        start: '24 kg one hand', progress: 'Heavier, not further',
        note: 'Anti-lateral-flexion, which is exactly what holding a high line asks of your trunk. One side at a time, heavy.',
      },
    ],
    tail: 'Then 25–30 min easy Z2 if you have it — run, bike or swim. Parked here on purpose: easy aerobic after upper-body lifting barely interferes, whereas after a leg day it eats the session you just did. Zero leg load the day before gates is deliberate and it is not negotiable.',
  },
  {
    n: 3, key: 'cond', weekday: 4, time: '19:15', title: 'Lateral & Shoulders', subtitle: 'The plane your programme was missing', minutes: 60,
    warmup: 'Five minutes on the bike, then leg swings side to side and ankle rocking. Frontal-plane work needs frontal-plane warm-up.',
    exercises: [
      {
        name: 'Lateral lunge', sets: '3×8 / leg', left: true,
        start: '8 kg each hand', progress: '+2 kg each hand when both legs clear it',
        note: 'Step wide, sit into the hip, keep the trailing leg straight. This is the pattern of an outside ski holding an edge, loaded. You have had nothing like it in the programme until now.',
      },
      {
        name: 'Sled push', sets: '4×20 m',
        start: '40 kg on the sled', progress: '+10 kg when 20 m takes under 12 seconds',
        note: 'High force, almost no eccentric load — close to a perfect exercise for a rebuilt knee, and it builds the exact hip extension a start needs.',
      },
      {
        name: 'Lateral sled drag', sets: '3×20 m / side', left: true,
        start: '20 kg', progress: 'Load before distance',
        note: 'Frontal-plane strength under real load with zero impact. Face the same way both directions so each leg leads once.',
      },
      {
        name: 'Skater squat', sets: '3×6 / leg', left: true,
        start: 'Bodyweight, counterbalanced with a 5 kg plate',
        progress: 'Lower the back knee further before adding load',
        note: 'Single-leg strength in a position closer to a carved turn than a split squat is. Hard — six good ones beats ten scrappy.',
      },
      { name: 'Seated shoulder press', sets: '3×10', compound: true, start: '14 kg each hand', note: 'Front delts and the overhead pattern.' },
      { name: 'Lateral raise', sets: '3×15', iso: true, start: '6 kg each hand', note: 'Second exposure of the week. Delts recover fast and respond to frequency.' },
      { name: 'Rear delt fly + face pull — superset', sets: '3×15 each', iso: true, start: '20 kg on the cable', note: 'Straight through. Rear delts fill the back of the shoulder, and face pulls are the cheapest insurance available for a winter of gate contact.' },
    ],
    tail: 'Then 1 km swim and the contrast spa: sauna 12 min → plunge 90 s, ×3. Best cold day of the week — twelve hours clear of Friday and light enough that the cold blunts nothing. Finish with the swelling test and log it.',
  },
  {
    n: 4, key: 'lowerB', weekday: 5, time: '08:15', title: 'Lower Power', subtitle: 'Short, fast, nothing heavy', minutes: 55,
    warmup: 'Longest warm-up of the week, including Spanish squats. Eat properly before this one — plyometrics on an empty stomach is a poor trade.',
    exercises: [
      {
        name: 'Plyometric block', sets: '4–6 sets', plyo: true,
        note: 'First, always, before any fatigue. If jump height or landing quality drops, the block is over for the day regardless of sets done. Full recovery between sets — this is a nervous-system session, not a conditioning one.',
      },
      {
        name: 'Trap bar jump', sets: '5×3', compound: true,
        start: '20 kg — about 30% of your working trap bar',
        progress: 'Only as the trap bar itself climbs. Speed is the target, never load',
        note: 'If the bar slows down, the set is finished. This is the lift that turns Monday\'s strength into a first gate.',
      },
      {
        name: 'Step-up, knee over toe', sets: '3×8 / leg', left: true,
        start: '8 kg each hand, knee-height box', progress: 'Height before load',
        note: 'Controlled, knee tracking over the toe. Drive through the heel of the top foot and do not push off the floor.',
      },
      {
        name: 'Romanian deadlift', sets: '3×8', compound: true,
        start: '50 kg — your logged 10-rep weight',
        progress: '+2.5 kg a week',
        note: 'Here rather than Monday so the week\'s hamstring work is not stacked on one day.',
      },
      { name: 'Single-leg calf raise', sets: '3×12 / leg', left: true, iso: true, start: 'Bodyweight', note: 'Standing — gastrocnemius, where Monday\'s seated version hits soleus.' },
      { name: 'Rotational cable chop', sets: '3×12 / side', start: '15 kg', note: 'Rotational power through a braced trunk. Superset with the calves.' },
    ],
    tail: 'Deliberately short and deliberately light. You race at weekends — Friday exists to make you fast, not tired.',
  },
  {
    n: 5, key: 'pull', weekday: 6, time: '16:00', title: 'Pull & Arms', subtitle: 'The one that gives way in a race week', minutes: 55,
    warmup: null,
    exercises: [
      {
        name: 'Weighted pull-up (or lat pulldown)', sets: '4×8', compound: true,
        start: 'Bodyweight, or 40 kg on the pulldown',
        progress: 'Add weight before adding reps — this number tells you whether the ten kilos is useful mass',
        note: 'Pull-ups over pulldowns wherever you can.',
      },
      { name: 'Chest-supported row', sets: '4×10', compound: true, start: '35 kg', note: 'Chest-supported so your lower back stays fresh — you deadlifted Monday and RDL\'d Friday.' },
      { name: 'Single-arm DB row', sets: '3×10 / side', start: '20 kg', note: 'Lets the stronger side pull the weaker one up.' },
      { name: 'Straight-arm pulldown', sets: '3×12', iso: true, start: '20 kg', note: 'Isolates the lat without the biceps giving out first. A width exercise, and width is most of the taper.' },
      { name: 'Shrug', sets: '3×12', iso: true, start: '24 kg each hand', note: 'Traps read as built from every angle. Hold the top for a second.' },
      { name: 'Hammer curl', sets: '3×10', iso: true, start: '12 kg each hand', progress: '+2 kg when 3×10 is clean', note: 'Your logged 14 kg for 8 is near-max — work at 12 for tens.' },
      { name: 'Preacher curl', sets: '3×10', iso: true, start: '15 kg', note: '' },
      { name: 'Farmer carry', sets: '3×30 m', start: '24 kg each hand', progress: 'Heavier, not further', note: 'Grip, trunk and traps at once. Cold hands on plastic in January will thank you.' },
    ],
    tail: 'Pairs well with a morning round — golf costs your legs and feet, not your lats. Not the day before a race: this is the session that gives way in a race week.',
  },
];

export const VOLUME: { muscle: string; sets: number; days: number; verdict: string }[] = [
  { muscle: 'Quads', sets: 12, days: 3, verdict: 'Trap bar, split squats, skater squats, step-ups — plus 90 minutes of gates, which is a huge eccentric quad load in itself.' },
  { muscle: 'Hamstrings & glutes', sets: 14, days: 3, verdict: 'Hip thrusts are the new addition and the one your start was missing.' },
  { muscle: 'Adductors & lateral', sets: 12, days: 2, verdict: 'Was near zero. Now a named day. The single biggest change in the programme.' },
  { muscle: 'Calves (both heads)', sets: 6, days: 2, verdict: 'Soleus seated, gastroc standing. Ankle stiffness is most of edge-change speed.' },
  { muscle: 'Back (lats, mid, traps)', sets: 17, days: 2, verdict: 'Trap bar Monday plus the whole of Saturday.' },
  { muscle: 'Chest', sets: 7, days: 1, verdict: 'One day is plenty at your training age, and it costs the skiing nothing.' },
  { muscle: 'Side delts', sets: 7, days: 2, verdict: 'Top of what recovers well. Highest visual payoff in the plan.' },
  { muscle: 'Rear delts + face pulls', sets: 9, days: 2, verdict: 'Posture, shoulder health, and the fullness most people miss.' },
  { muscle: 'Biceps', sets: 6, days: 1, verdict: 'Plus everything the rows give you. Trimmed from twice weekly to make room for the lateral work.' },
  { muscle: 'Triceps', sets: 6, days: 1, verdict: 'Plus all the pressing.' },
  { muscle: 'Trunk & anti-rotation', sets: 9, days: 3, verdict: 'Pallof, carries, chops. This is what holds a line when the hill pushes back.' },
];

/* ------------------------------------------------------- block scaling */

/** Which of the five days survive in a given block. */
export function daysInBlock(b: Block): GymDay[] {
  if (b.gymDays >= 5) return DAYS;
  if (b.gymDays === 4) return DAYS.filter((d) => d.key !== 'pull');           // arms drop first
  if (b.gymDays === 3) return DAYS.filter((d) => d.key === 'lowerA' || d.key === 'cond' || d.key === 'lowerB');
  return DAYS.filter((d) => d.key === 'lowerA' || d.key === 'lowerB');        // 2: strength and power
}

export type Prescribed = {
  day: GymDay;
  compounds: string;
  isolationScale: number;
  plyo: string[];
  raceWeek: boolean;
  notes: string[];
  /**
   * When the block or the race week replaces the session outright rather than
   * scaling it, this is what you actually do. Non-null means ignore the day's
   * own exercise list.
   */
  replaces: { title: string; exercises: Exercise[] } | null;
};

/** Race week turns Friday into a 25-minute wake-up, not a scaled leg day. */
const PRIMING: Exercise[] = [
  { name: 'Trap bar jump', sets: '3×3 @ 30%', note: 'Fast. The bar should feel light and leave the floor quickly.' },
  { name: 'Split jump', sets: '3×3', note: 'Land quietly. Quality only — you are waking the nervous system, not training it.' },
  { name: 'Sled push', sets: '2×20 m', note: 'Brisk, not brutal.' },
];

export function prescribe(iso: string, day: GymDay, rung: Rung, plyoSuspended = false): Prescribed {
  const b = blockFor(iso);
  const race = isRaceWeek(iso);
  const notes: string[] = [];

  let compounds = b.compounds;
  const isolationScale = b.n <= 4 ? 1 : b.n <= 6 ? 0.7 : 0.55;
  let replaces: Prescribed['replaces'] = null;

  if (b.n <= 3) {
    notes.push('Strength phase. Ignore the percentages and just add weight: if last week moved, this week is heavier. That is the entire programme until Christmas.');
  }

  if (race) {
    if (day.key === 'push') { compounds = `${b.compounds} — cut the top set`; notes.push('Race week: keep the movement, lose the fatigue.'); }
    if (day.key === 'lowerB') {
      compounds = '3×3 @ 30%, speed only';
      replaces = { title: 'Priming session — 25 min', exercises: PRIMING };
      notes.push('Race week: Friday is not a leg day. It is a 25-minute wake-up that adds no fatigue — and the plyometric block comes out entirely.');
    }
    if (day.key === 'pull') notes.push('Race week: Pull is dropped. You will not miss one week of it.');
    if (day.key === 'cond') notes.push('Race week: sled and lateral work stay, shoulders come out. Sauna only, no plunge — long cold pre-race leaves you flat.');
    if (day.key === 'lowerA') notes.push('Race week: Monday as normal — furthest point from the race. Load it here or nowhere.');
  }

  if (b.n === 7 && (day.key === 'push' || day.key === 'pull')) {
    notes.push('Block 7: Push and Pull merge into one upper day. Pick the movements you miss most.');
  }
  if (b.n === 6 && (day.key === 'lowerA' || day.key === 'lowerB')) {
    notes.push('Block 6: contrast pairs — a heavy double, ninety seconds, then a jump. Same bar, different intent. This is where the winter\'s strength becomes speed.');
  }
  if (b.n >= 6 && (day.key === 'push' || day.key === 'pull')) {
    notes.push('From here the arm and delt volume comes down. That is the trade you agreed to: the physique holds, the skiing gets the room.');
  }
  if (b.n === 9) notes.push('Taper: speed only. Nothing that leaves a mark.');

  if (plyoSuspended && day.key === 'lowerB') {
    notes.push('Plyometric block suspended — the stop rule fired. Everything else in the session stands.');
  }

  const plyo = day.key === 'lowerB' && !replaces && !plyoSuspended ? LADDER[rung - 1].work : [];

  return { day, compounds, isolationScale, plyo, raceWeek: race, notes, replaces };
}

/** The gym day scheduled on a date, or null. */
export function gymDayOn(iso: string): GymDay | null {
  const b = blockFor(iso);
  const wd = dow(iso);
  return daysInBlock(b).find((d) => d.weekday === wd) ?? null;
}
