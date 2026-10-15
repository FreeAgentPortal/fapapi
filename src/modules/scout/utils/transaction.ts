import mongoose, { ClientSession } from 'mongoose';
import { eventBus } from '../../../lib/eventBus';

export async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try { return (await session.withTransaction(() => work(session))) as T; }
  finally { await session.endSession(); }
}

export function publishScoutEvent(name: string, payload: unknown) {
  void eventBus.publish(name, payload).catch(error => console.error(`[Scout] Notification ${name} failed`, error));
}
