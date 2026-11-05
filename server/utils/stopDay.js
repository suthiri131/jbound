import { badRequest } from "./httpError.js";

export function validateStopDay(trip, day) {
  if (!day) return; // Unscheduled stops are always allowed.
  const start = trip.start_date;
  const end = trip.end_date || start;
  if ((start && day < start) || (end && day > end)) {
    throw badRequest("Stop day must fall within the trip dates");
  }
}
