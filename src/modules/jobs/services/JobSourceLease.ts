import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import JobSourceModel from '../models/JobSource';

const LEASE_MS = 5 * 60_000;

export async function acquireSource(id: string, dueOnly = false, requireEnabled = true) {
  if (!Types.ObjectId.isValid(id)) throw new ErrorUtil('Invalid job source ID', 400);
  const now = new Date();
  const token = randomUUID();
  const source = await JobSourceModel.findOneAndUpdate(
    {
      _id: id,
      ...(requireEnabled ? { enabled: true } : {}),
      ...(dueOnly ? { nextRunAt: { $lte: now } } : {}),
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }],
    },
    { $set: { lockToken: token, lockedUntil: new Date(now.getTime() + LEASE_MS) } },
    { new: true }
  ).lean();
  if (!source) {
    if (!(await JobSourceModel.exists({ _id: id }))) throw new ErrorUtil('Job source not found', 404);
    throw new ErrorUtil('Job source is busy, disabled, or not due', 409);
  }
  return { source, token };
}

export async function renewSource(id: string, token: string): Promise<void> {
  const now = new Date();
  const result = await JobSourceModel.updateOne(
    { _id: id, lockToken: token, lockedUntil: { $gt: now } },
    { $set: { lockedUntil: new Date(now.getTime() + LEASE_MS) } }
  );
  if (result.matchedCount !== 1) throw new Error('Job source lease lost');
}

export async function releaseSource(id: string, token: string): Promise<void> {
  await JobSourceModel.updateOne({ _id: id, lockToken: token }, { $unset: { lockToken: 1, lockedUntil: 1 } });
}
