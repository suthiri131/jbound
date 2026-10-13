/**
 * ============================================================
 * CHECKPOINT CONGESTION HEURISTIC  (core business logic — see README AI disclosure)
 * TODO(team): AI-generated reference draft. Rewrite in your own words before submission;
 *             the unit tests in server/tests/ tell you if the rewrite still behaves.
 * ============================================================
 * NOT a live prediction. A lookup table of "typical" congestion scores
 * (0–100) by direction × day type × hour, tuned from commonly reported
 * patterns:
 *   • JB → SG weekday mornings (≈4–8am): Malaysian commuters into SG.
 *   • SG → JB weekday evenings (≈5–9pm): commuters heading home to JB.
 *   • Friday evening / Saturday morning: Singaporeans heading into JB.
 *   • Sunday late afternoon–night: everyone returning to SG.
 * Tuas (Second Link) is usually lighter than Woodlands → scaled down.
 *
 * Teams: tweak the tables below with your own observations — that tuning
 * is the "problem-solving" part graders will ask about.
 */

// prettier-ignore
const PROFILES = {
  to_jb: {
    weekday:  [10, 8, 5, 5, 5, 8,15,20,20,18,18,20,22,25,28,35,50,75,85,80,60,40,25,15],
    friday:   [12,10, 6, 5, 5, 8,15,20,22,22,25,28,30,35,45,60,75,90,95,92,85,65,45,25],
    saturday: [15,10, 8,10,25,45,70,85,85,75,60,50,45,40,40,40,40,40,40,35,30,25,20,15],
    sunday:   [10, 8, 6, 8,15,30,45,55,55,50,40,35,30,28,25,25,25,25,25,25,20,18,15,10],
  },
  to_sg: {
    weekday:  [10, 8,10,20,60,85,95,90,70,45,30,25,22,22,22,25,28,30,30,28,25,22,18,12],
    friday:   [10, 8,10,20,60,85,95,88,65,40,30,25,22,22,22,25,28,30,30,28,25,22,18,12],
    saturday: [10, 8, 8,10,25,40,50,45,35,30,30,30,32,35,38,40,45,50,55,55,50,40,30,18],
    sunday:   [12,10, 8,10,25,35,40,35,30,30,32,35,40,45,55,65,75,85,90,92,88,75,55,30],
  },
};

const CHECKPOINT_FACTOR = { woodlands: 1.0, tuas: 0.65 };
const HOLIDAY_FACTOR = 1.2; // long weekends / school holidays push everything up

export const DISCLAIMER = 'Estimates based on typical patterns, not live prediction.';

export function levelFor(score) {
  if (score < 40) return 'Low';
  if (score < 70) return 'Medium';
  return 'High';
}

/** 0 = Sunday … 6 = Saturday → profile key */
export function dayTypeFor(dayOfWeek) {
  if (dayOfWeek === 0) return 'sunday';
  if (dayOfWeek === 6) return 'saturday';
  if (dayOfWeek === 5) return 'friday';
  return 'weekday';
}

/** Current day-of-week + hour in Singapore time, regardless of server timezone. */
export function sgNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday').value;
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { dayOfWeek, hour };
}

export function scoreFor({ checkpoint, direction, dayOfWeek, hour, holiday = false }) {
  const profile = PROFILES[direction]?.[dayTypeFor(dayOfWeek)];
  if (!profile) throw new Error(`Unknown direction ${direction}`);
  const factor = (CHECKPOINT_FACTOR[checkpoint] ?? 1) * (holiday ? HOLIDAY_FACTOR : 1);
  return Math.min(100, Math.round(profile[hour] * factor));
}

/**
 * Full-day curve for the slider + the selected hour + suggested best times.
 */
export function estimateCongestion({ checkpoint, direction, dayOfWeek, hour, holiday = false }) {
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const score = scoreFor({ checkpoint, direction, dayOfWeek, hour: h, holiday });
    return { hour: h, score, level: levelFor(score) };
  });

  // Best times: lowest-scoring hours between 6am and 11pm (people rarely want to cross at 3am).
  const bestHours = hourly
    .filter((h) => h.hour >= 6 && h.hour <= 23)
    .sort((a, b) => a.score - b.score || a.hour - b.hour)
    .slice(0, 3)
    .map((h) => h.hour)
    .sort((a, b) => a - b);

  return {
    checkpoint,
    direction,
    dayType: dayTypeFor(dayOfWeek),
    holiday,
    selected: hourly[hour],
    hourly,
    bestHours,
    disclaimer: DISCLAIMER,
  };
}
