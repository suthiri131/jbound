import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireTripMember,
  requireTripOwner,
} from "../middleware/tripAccess.js";
import { badRequest } from "../utils/httpError.js";
import { ALLOWED_IMAGE_TYPES } from "../services/storageService.js";
import * as trips from "../controllers/tripsController.js";
import * as itinerary from "../controllers/itineraryController.js";
import * as expenses from "../controllers/expensesController.js";

// TO DO
import * as messages from "../controllers/messagesController.js";
// import * as expenses from '../controllers/expensesController.js';
import * as memories from "../controllers/memoriesController.js";

import * as s from "./schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MiB leaves room for multipart overhead on Vercel.
  fileFilter: (_req, file, cb) =>
    ALLOWED_IMAGE_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(badRequest("Only JPG, PNG, WEBP or GIF images")),
});

const r = Router();
r.use(requireAuth);

// Trips (the satchel)
r.get("/", validate({ query: s.tripsQuery }), trips.listMyTrips);
r.post("/", validate({ body: s.createTripBody }), trips.createTrip);
r.post("/join", validate({ body: s.joinBody }), trips.joinByCode);

const member = [validate({ params: s.tripParam }), requireTripMember];
const memberWith = (params) => [validate({ params }), requireTripMember];

r.get("/:tripId", member, trips.getTrip);

// Ledger
r.get('/:tripId/expenses', member, expenses.getExpenses);
r.post('/:tripId/expenses', member, validate({ body: s.createExpenseBody }), expenses.createExpense);
r.put('/:tripId/expenses/:expenseId', memberWith(s.tripExpenseParam), validate({ body: s.createExpenseBody }), expenses.updateExpense);
r.get('/:tripId/expenses/balances', member, validate({ query: s.balancesQuery }), expenses.getBalances);
r.post('/:tripId/expenses/settlements', member, validate({ body: s.settlementBody }), expenses.createSettlement);
r.patch(
  "/:tripId",
  member,
  validate({ body: s.updateTripBody }),
  trips.updateTrip,
);
r.delete("/:tripId", member, requireTripOwner, trips.deleteTrip);
r.post("/:tripId/archive", member, trips.archiveTrip);
r.post(
  "/:tripId/invite-code",
  member,
  requireTripOwner,
  trips.regenerateInviteCode,
);
r.post(
  "/:tripId/members",
  member,
  validate({ body: s.inviteBody }),
  trips.inviteMember,
);
r.delete(
  "/:tripId/members/:userId",
  memberWith(s.tripMemberParam),
  trips.removeMember,
);

// Itinerary / bucket list
r.get("/:tripId/itinerary", member, itinerary.listItems);
r.post(
  "/:tripId/itinerary",
  member,
  validate({ body: s.addItemBody }),
  itinerary.addItem,
);
r.put(
  "/:tripId/itinerary/order",
  member,
  validate({ body: s.reorderBody }),
  itinerary.reorderItems,
);
r.patch(
  "/:tripId/itinerary/:itemId",
  memberWith(s.tripItemParam),
  validate({ body: s.updateItemBody }),
  itinerary.updateItem,
);
r.delete(
  "/:tripId/itinerary/:itemId",
  memberWith(s.tripItemParam),
  itinerary.deleteItem,
);
r.get("/:tripId/feasibility", member, itinerary.getFeasibility);
r.get(
  "/:tripId/route",
  member,
  validate({ query: s.routeQuery }),
  itinerary.getDayRoute,
);

// Camp chat
r.get(
  "/:tripId/messages",
  member,
  validate({ query: s.messagesQuery }),
  messages.listMessages,
);
r.post(
  "/:tripId/messages",
  member,
  validate({ body: s.messageBody }),
  messages.sendMessage,
);

// Ledger
// r.get('/:tripId/expenses', member, expenses.listExpenses);
// r.post('/:tripId/expenses', member, validate({ body: s.createExpenseBody }), expenses.createExpense);
// r.delete('/:tripId/expenses/:expenseId', memberWith(s.tripExpenseParam), expenses.deleteExpense);
// r.get('/:tripId/balances', member, validate({ query: s.balancesQuery }), expenses.getBalances);
// r.post('/:tripId/settlements', member, validate({ body: s.settlementBody }), expenses.createSettlement);

// Memory box (multer runs before validate so multipart text fields are in req.body)
r.get("/:tripId/memories", member, memories.listMemories);
r.post(
  "/:tripId/memories",
  member,
  upload.single("image"),
  validate({ body: s.memoryFields }),
  memories.addMemory,
);
r.patch(
  "/:tripId/memories/:memoryId",
  memberWith(s.tripMemoryParam),
  validate({ body: s.memoryFields }),
  memories.updateMemory,
);
r.delete(
  "/:tripId/memories/:memoryId",
  memberWith(s.tripMemoryParam),
  memories.deleteMemory,
);

export default r;
