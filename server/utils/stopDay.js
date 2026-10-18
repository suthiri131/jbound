import { badRequest } from './httpError.js';

/** Dates are validated ISO date strings, so lexical comparison is chronological. */
export function validateStopDay(trip, day) {
  if (!day) return; // Unscheduled stops are always allowed.
  const start = trip.start_date;
  const end = trip.end_date || start;
  if ((start && day < start) || (end && day > end)) {
    throw badRequest('Stop day must fall within the trip dates');
  }
}
