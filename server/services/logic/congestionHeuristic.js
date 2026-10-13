const PROFILES_Woodlands = {
  to_jb: {
    weekday:  [10, 8, 5, 5, 8, 12, 18, 25, 30, 25, 20, 20, 25, 25, 30, 35, 50, 70, 85, 85, 75, 55, 35, 20],
    friday:   [15, 10, 8, 5, 8, 12, 20, 30, 35, 30, 25, 30, 35, 40, 50, 60, 75, 90, 95, 95, 90, 80, 60, 35],
    saturday: [15, 10, 10, 15, 25, 40, 60, 75, 85, 90, 85, 75, 65, 55, 50, 45, 40, 40, 35, 30, 25, 20, 15, 10],
    sunday:   [10, 8, 5, 8, 15, 25, 40, 50, 55, 50, 45, 40, 35, 30, 25, 25, 25, 25, 25, 20, 20, 15, 10, 10],
  },
  to_sg: {
    weekday:  [10, 8, 10, 20, 55, 75, 90, 95, 90, 75, 55, 40, 30, 25, 30, 35, 45, 60, 75, 75, 65, 45, 30, 15],
    friday:   [10, 8, 10, 20, 55, 75, 90, 95, 85, 65, 45, 35, 30, 25, 25, 30, 35, 40, 45, 40, 35, 30, 20, 15],
    saturday: [10, 8, 10, 15, 25, 35, 45, 50, 45, 40, 35, 35, 40, 45, 50, 55, 60, 65, 70, 70, 65, 50, 35, 20],
    sunday:   [10, 8, 10, 15, 25, 35, 40, 40, 35, 35, 40, 45, 50, 55, 65, 75, 85, 90, 95, 95, 90, 80, 60, 35],
  },
};

const PROFILES_Tuas = {
  to_jb: {
    weekday:  [10, 10,  5,  5, 10, 15, 20, 25, 25, 20, 20, 20, 25, 25, 30, 35, 50, 65, 75, 80, 70, 50, 30, 15],
    friday:   [10, 10,  5,  5, 10, 15, 20, 25, 25, 25, 25, 30, 35, 40, 45, 55, 70, 80, 90, 95, 90, 75, 55, 30],
    saturday: [15, 10,  5,  5, 15, 25, 40, 55, 70, 80, 75, 65, 55, 45, 40, 35, 35, 30, 30, 25, 25, 20, 15, 10],
    sunday:   [10, 10,  5,  5, 10, 15, 25, 35, 45, 50, 45, 40, 35, 30, 25, 25, 20, 20, 20, 20, 15, 15, 10, 10],
  },

  to_sg: {
    weekday:  [10, 10, 15, 25, 50, 75, 90, 95, 85, 65, 45, 30, 25, 25, 25, 30, 35, 35, 30, 25, 20, 15, 15, 10],
    friday:   [10, 10, 15, 25, 50, 75, 90, 95, 85, 65, 45, 30, 25, 25, 25, 30, 35, 35, 30, 25, 20, 15, 15, 10],
    saturday: [10, 10, 10, 10, 15, 25, 35, 40, 45, 40, 35, 30, 30, 35, 40, 45, 50, 55, 60, 60, 50, 40, 25, 15],
    sunday:   [10, 10,  5, 10, 15, 25, 35, 40, 35, 30, 30, 35, 40, 50, 60, 70, 80, 85, 90, 95, 90, 80, 60, 35],
  },
};
// Above are congestion levels based on waiting times data from https://www.mha.gov.sg/media-room/newsroom/written-reply-to-parliamentary-question-on-traffic-volume-and-waiting-times-at-singapore-malaysia-land-checkpoints-by-mr-k-shanmugam-minister-for-home-affairs-and-minister-for-law/
// Came up with the congestion score based on waiting times (time spent clearing the checkpoint)

const PROFILES = {
  woodlands: PROFILES_Woodlands,
  tuas: PROFILES_Tuas
};

const HOLIDAY_FACTOR = 1.2;

export const DISCLAIMER = 'Estimates based on typical patterns, not live prediction.';

export function dayTypeFor(dayOfWeek) {
    if (dayOfWeek == 0) {
        return 'sunday'
    } else if (dayOfWeek == 6) {
        return 'saturday'
    } else if (dayOfWeek == 5) {
        return 'friday'
    } else {return 'weekday'}
}

// calculating score
export function scoreFor({checkpoint, direction, dayOfWeek, hour, holiday = false}) {
    const profile = PROFILES[checkpoint]?.[direction]?.[dayTypeFor(dayOfWeek)];

    if (!profile) {
        throw new Error('Unknown checkpoint or direction')
    }

    const factor = holiday ? HOLIDAY_FACTOR : 1;

    // in case score exceeds 100
    return Math.min(100, Math.round(profile[hour] * factor));
}

// returns the rating for the congestion score
export function levelFor(score) {
    if (score < 40) {
        return 'Low'
    } else if (score < 70) {
        return 'Medium'
    } else {return 'High'}
}

// getting the current day and hour in Singapore Time
export function sgNow(date = new Date()) {
    // formats the date --> Fri, 18 (friday, 1800 hours)
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        weekday: 'short',
        hour: '2-digit',
        hourCycle: 'h23'
    })

    const formattedDate = formatter.format(date);

    const [weekday, hourString] = formattedDate.split(', ');

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const dayOfWeek = days.indexOf(weekday);

    const hour = Number(hourString);

    return { dayOfWeek, hour };
}

// 24hr forecast for a selected checkpoint
export function estimateCongestion({checkpoint, direction, dayOfWeek, hour, holiday = false }) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new Error('Hour must be between 0 and 23');
    }

    const hourly = []

    for (let h=0; h<24; h++) {
        const score = scoreFor({
            checkpoint, 
            direction, 
            dayOfWeek,
            hour: h,
            holiday
        });

        const level = levelFor(score)

        hourly.push({
            hour: h,
            score: score,
            level: level
        });
    }

    // set hours from 6am to 11pm (normal people hours)
    const availableHours = hourly.filter(h => h.hour >= 6 && h.hour <= 23);

    // sort by congestion score, then by hour
    availableHours.sort((a, b) => {
    if (a.score !== b.score) {
        return a.score - b.score;
    }

    return a.hour - b.hour;
    });

    // select the 3 least congested hours
    const bestHours = [];
    for (let i = 0; i < 3 && i < availableHours.length; i++) {
    bestHours.push(availableHours[i].hour);
    }

    // arranging the hours chronologically
    bestHours.sort((a, b) => a - b);

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
