/**
 * The spa, used deliberately rather than because it is there.
 *
 * David Lloyd gives you six tools — sauna, steam, cold plunge, cold room, fire
 * room and hot tub — and they are not interchangeable. One of them can actively
 * work against the thing you are currently trying to do.
 *
 * THE RULE THAT MATTERS MOST:
 *
 *   Cold water immersion within roughly six hours of resistance training blunts
 *   the strength and hypertrophy adaptation from that session. This is one of
 *   the better-established findings in the recovery literature, and it is
 *   inconvenient, because a cold plunge after a heavy leg day feels excellent
 *   and is precisely the wrong thing while you are trying to add ten kilos.
 *
 *   So cold is not banned. It is scheduled — on days with no lifting, and on
 *   race days, where recovering for tomorrow genuinely does outrank adapting
 *   for March.
 *
 * Heat does not carry the same penalty. Sauna after lifting is fine and
 * probably helps a little. What heat is genuinely good for is sleep: a hot
 * twenty minutes a couple of hours before bed drops core temperature on the
 * way back down and people fall asleep faster.
 *
 * Contrast bathing has weaker evidence than its popularity suggests. It is in
 * here because it reliably makes people feel better and that is worth
 * something, not because it does what the internet says it does.
 */

export type Facility = 'sauna' | 'steam' | 'plunge' | 'coldroom' | 'fireroom' | 'hottub' | 'pool';

export type FacilitySpec = {
  key: Facility;
  name: string;
  dose: string;
  /** What it is actually for. */
  good: string;
  /** When not to. */
  avoid: string | null;
  /** True when it interferes with the adaptation from a lifting session. */
  blunts: boolean;
};

export const FACILITIES: Record<Facility, FacilitySpec> = {
  sauna: {
    key: 'sauna', name: 'Sauna', dose: '12–20 min, one or two rounds',
    good: 'Heat adaptation, plasma volume, and it is the best sleep aid in the building if you use it two hours before bed. Safe straight after lifting — it does not blunt the session the way cold does.',
    avoid: 'Long and hot the day before a race leaves you flat. Keep it to twelve minutes in race week.',
    blunts: false,
  },
  steam: {
    key: 'steam', name: 'Steam room', dose: '10–15 min',
    good: 'Gentler than the sauna and far kinder when you are congested or run down — the humidity does something for the airways that dry heat does not.',
    avoid: null,
    blunts: false,
  },
  plunge: {
    key: 'plunge', name: 'Cold plunge', dose: '60–120 s, up to three rounds',
    good: 'Genuinely useful when the next performance matters more than the adaptation — between race runs, after a race day, or in a heavy race block.',
    avoid: 'Within six hours of lifting, because it measurably reduces the strength and size you get from that session. Also not before a race: cold muscle is slow muscle.',
    blunts: true,
  },
  coldroom: {
    key: 'coldroom', name: 'Cold room', dose: '3–5 min',
    good: 'The mild version. Cools you down after heat without the full immersion, so it costs the session far less than the plunge does.',
    avoid: 'Still cold. Treat it as a soft plunge rather than as free.',
    blunts: true,
  },
  fireroom: {
    key: 'fireroom', name: 'Fire room', dose: '15–25 min',
    good: 'Low-grade heat you can sit in for a while. The right choice on a flat day when you want to feel human again rather than chase an adaptation.',
    avoid: null,
    blunts: false,
  },
  hottub: {
    key: 'hottub', name: 'Hot tub', dose: '10–15 min',
    good: 'Mild heat, easy on the system, good for stiff hips and a rebuilt knee after a long drive. The safest thing on this list when you are not sure what you need.',
    avoid: null,
    blunts: false,
  },
  pool: {
    key: 'pool', name: 'Pool', dose: '800 m–1 km easy',
    good: 'Zero impact through the knee, moves blood without adding load, and it is the only aerobic work that costs your legs nothing at all.',
    avoid: null,
    blunts: false,
  },
};

/* ------------------------------------------------------- the weekly shape */

export type SpaSlot = {
  weekday: number;      // 1 Mon … 7 Sun
  at: string;
  minutes: number;
  title: string;
  facilities: Facility[];
  why: string;
};

/**
 * Where the spa sits in a normal week.
 *
 * The important change from the old plan: the full contrast session has moved
 * off Thursday and onto Sunday. Thursday is now a lifting day — the lateral and
 * shoulder session — and plunging ninety minutes after it would have quietly
 * taxed the adaptation every single week. Sunday has no lifting in it at all,
 * which is exactly what a contrast day wants.
 */
export const SPA_WEEK: SpaSlot[] = [
  {
    weekday: 1, at: '20:30', minutes: 20, title: 'Sauna — sleep, not recovery',
    facilities: ['sauna'],
    why: 'After the heaviest session of the week. Heat only: cold tonight would take a bite out of exactly the session you just did. Two hours before bed, so core temperature is falling as you get in.',
  },
  {
    weekday: 4, at: '20:15', minutes: 35, title: 'Swim and sauna',
    facilities: ['pool', 'sauna'],
    why: 'Easy kilometre to move blood after the lateral work, then heat. No plunge — Thursday is a lifting day now, and it did not used to be.',
  },
  {
    weekday: 6, at: '19:00', minutes: 20, title: 'Hot tub',
    facilities: ['hottub'],
    why: 'Mild and short. If you are racing tomorrow this is all you get — long heat or any cold the night before leaves you flat on the first run.',
  },
  {
    weekday: 7, at: '15:00', minutes: 45, title: 'Full contrast — the one day it belongs',
    facilities: ['sauna', 'plunge', 'pool'],
    why: 'Sauna 12 min → plunge 90 s, three rounds, finishing cold. The only day of the week with no lifting either side of it, which is the whole reason it lives here now rather than on Thursday.',
  },
];

/* ------------------------------------------- what to do on a given day */

export type RecoveryState = {
  /** Readiness band from the morning check-in. */
  band: 'green' | 'amber' | 'red' | null;
  illness: boolean;
  /** 1–10 from the check-in. */
  soreness: number | null;
  sleepH: number | null;
  /** Did today include resistance training? */
  liftedToday: boolean;
  /** Days until the next race — negative or zero means today. */
  daysToRace: number | null;
  /** True once the race is done for the day. */
  raceFinished?: boolean;
};

export type Recommendation = {
  headline: string;
  /** In order. */
  steps: { facility: Facility; dose: string }[];
  why: string;
  /** What specifically not to do today, and why. */
  avoid: string | null;
  /** Something other than the spa, when that is the honest answer. */
  instead: string | null;
};

/**
 * The one honest recommendation for today.
 *
 * Ordered by what actually outranks what: being unwell beats everything, then
 * race proximity, then whether you lifted, then how you feel.
 */
export function recoveryFor(s: RecoveryState): Recommendation {
  /* --------------------------------------------------- 1. actually unwell */
  if (s.illness) {
    return {
      headline: 'Steam and an early night',
      steps: [
        { facility: 'steam', dose: '10 min, and get out if it feels like effort' },
        { facility: 'hottub', dose: '10 min if you want it' },
      ],
      why:
        'Steam rather than sauna: the humidity is kinder on the airways and the cardiovascular load is lower. Heat feels like doing something when you are ill, which is precisely why it is worth capping.',
      avoid:
        'No plunge and no cold room. Cold is a stressor and you have no spare capacity for one today. If you have a temperature, skip the spa entirely — heat on top of a fever is a genuinely bad idea.',
      instead:
        'The thing that actually works here is sleep and food. If it lasts more than a few days or goes to your chest, that is a doctor rather than a sauna.',
    };
  }

  /* ------------------------------------------------- 2. the race outranks */
  const racingSoon = s.daysToRace != null && s.daysToRace >= 0 && s.daysToRace <= 1;
  if (racingSoon && !s.raceFinished) {
    return {
      headline: 'Hot tub, fifteen minutes, and nothing else',
      steps: [{ facility: 'hottub', dose: '10–15 min, early evening' }],
      why: 'Enough to loosen off after the drive and help you sleep. That is all you want the night before a start.',
      avoid:
        'No plunge, no cold room, no long sauna. Cold muscle is slow muscle, and a long hot session the night before leaves you flat on the first run. This is the one time of the week the spa can actively cost you.',
      instead: 'Kit check and an early night are worth more than anything in the spa tonight.',
    };
  }

  if (s.raceFinished) {
    return {
      headline: 'Plunge — today it is the right call',
      steps: [
        { facility: 'sauna', dose: '10 min to warm through first' },
        { facility: 'plunge', dose: '90 s, three rounds' },
        { facility: 'pool', dose: '400 m very easy to finish' },
      ],
      why:
        'Racing is the one situation where cold earns its place: you want to be fresh tomorrow more than you want the adaptation from today. The usual objection does not apply because today was not a lifting session.',
      avoid: null,
      instead: null,
    };
  }

  /* ------------------------------------------------ 3. flat or wrecked */
  if (s.band === 'red' || (s.sleepH != null && s.sleepH < 6)) {
    return {
      headline: 'Fire room, and get to bed early',
      steps: [
        { facility: 'fireroom', dose: '20 min, sitting still' },
        { facility: 'hottub', dose: '10 min if you fancy it' },
      ],
      why:
        'Low-grade heat, no shock, nothing to recover from. On a flat day the point is to feel human rather than to chase an adaptation, and heat two hours before bed is the single most reliable sleep aid in the building.',
      avoid: 'No plunge. Cold is another stressor on a day you have none to spare.',
      instead: 'Nine hours in bed will do more than anything on this list.',
    };
  }

  /* --------------------------------------- 4. lifted today: heat only */
  if (s.liftedToday) {
    const sore = (s.soreness ?? 0) >= 7;
    return {
      headline: sore ? 'Sauna, then the hot tub' : 'Sauna, twenty minutes',
      steps: sore
        ? [
          { facility: 'sauna', dose: '15 min' },
          { facility: 'hottub', dose: '10 min' },
          { facility: 'pool', dose: '400 m easy if you have the time' },
        ]
        : [{ facility: 'sauna', dose: '12–20 min, ideally two hours before bed' }],
      why:
        'Heat is free after lifting — it does not interfere with the session and it helps you sleep, which is where the adaptation actually happens.',
      avoid:
        'No plunge and no cold room for six hours after a lifting session. Cold measurably reduces the strength and size you get from the work you just did, and you are in the middle of a ten-kilo build. It will still be there on Sunday.',
      instead: null,
    };
  }

  /* ------------------------------------- 5. no lifting: contrast is on */
  if (s.band === 'amber') {
    return {
      headline: 'Sauna and a short plunge',
      steps: [
        { facility: 'sauna', dose: '12 min' },
        { facility: 'plunge', dose: '60 s, twice' },
      ],
      why: 'No lifting today, so cold costs you nothing. Keep it short — you came in amber, and contrast is meant to leave you better than it found you.',
      avoid: null,
      instead: null,
    };
  }

  return {
    headline: 'Full contrast',
    steps: [
      { facility: 'sauna', dose: '12 min' },
      { facility: 'plunge', dose: '90 s' },
      { facility: 'sauna', dose: '12 min' },
      { facility: 'plunge', dose: '90 s' },
      { facility: 'sauna', dose: '12 min' },
      { facility: 'plunge', dose: '90 s — finish cold' },
    ],
    why:
      'Nothing lifted today, so the plunge is free. Three rounds, finishing cold. This is the session the rest of the week works around.',
    avoid: null,
    instead: null,
  };
}

/** Trim a spa slot so it cannot run past closing. */
export function withinHours(slot: SpaSlot, openAt: number, closeAt: number): SpaSlot | null {
  const m = (t: string) => {
    const x = /^(\d{1,2}):(\d{2})/.exec(t);
    return x ? Number(x[1]) * 60 + Number(x[2]) : 0;
  };
  const start = Math.max(m(slot.at), openAt);
  const end = Math.min(start + slot.minutes, closeAt);
  // Under ten minutes is not a spa session, it is a wasted trip.
  if (end - start < 10) return null;
  const hh = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
  return { ...slot, at: hh, minutes: end - start };
}

export const SPA_RULES = [
  'Cold within six hours of lifting blunts the strength and size you get from that session. This is the one rule worth actually remembering, and it is why the plunge lives on Sunday.',
  'Heat carries no such penalty. Sauna straight after a lift is fine, and two hours before bed it is the best sleep aid in the building.',
  'The night before a race: hot tub, fifteen minutes, nothing else. No cold, no long sauna. Cold muscle is slow muscle.',
  'After a race, cold is correct — being fresh tomorrow outranks adapting from today, and you did not lift.',
  'Ill: steam rather than sauna, and nothing at all if you have a temperature.',
  'Hydrate. Twenty minutes in a sauna costs you more fluid than you think, and you are already chasing a calorie surplus.',
  'The gym is open 06:00 to 22:00, so the last useful slot starts around 21:15. Nothing in this plan is scheduled to finish in a car park.',
];
