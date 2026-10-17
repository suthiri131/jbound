import { Router } from 'express';
import { z } from 'zod';
import {
  createExpense,
  createSettlement,
  getBalances,
  getExpenses,
  updateExpense,
} from '../controllers/expensesController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTripMember } from '../middleware/tripAccess.js';
import { validate } from '../middleware/validate.js';

const uuid = z.string().uuid();
const tripParams = z.object({ tripId: uuid });
const expenseParams = tripParams.extend({ expenseId: uuid });
const expenseBody = z.object({
  amount: z.number().finite().positive().max(100000000),
  currency: z.enum(['SGD', 'MYR']),
  description: z.string().trim().min(1).max(200),
  paidBy: uuid,
  splitAmong: z.array(uuid).min(1).max(100),
}).strict().refine(({ splitAmong }) => new Set(splitAmong).size === splitAmong.length, {
  message: 'Split members must be unique',
  path: ['splitAmong'],
});
const settlementBody = z.object({
  from: uuid,
  to: uuid,
  amountSgd: z.number().finite().positive().max(100000000),
}).strict();

const router = Router({ mergeParams: true });
router.use(validate({ params: tripParams }), requireAuth, requireTripMember);

router.get('/', getExpenses);
router.post('/', validate({ body: expenseBody }), createExpense);
router.put('/:expenseId', validate({ params: expenseParams, body: expenseBody }), updateExpense);
router.get('/balances', getBalances);
router.post('/settlements', validate({ body: settlementBody }), createSettlement);

export default router;
