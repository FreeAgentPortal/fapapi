import mongoose, { Schema } from 'mongoose';
import { ActiveProfile, PROFILE_TYPES } from '../types';

interface PresenceLease {
  _id: string;
  expiresAt: Date;
  profiles: ActiveProfile[];
}

// One lease per server process, shared by all workers/hosts using this database.
// No account documents, credentials or transport socket IDs are persisted here.
const schema = new Schema<PresenceLease>({
  _id: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  profiles: [{
    _id: false,
    profileId: { type: String, required: true },
    profileType: { type: String, enum: PROFILE_TYPES, required: true },
    displayName: { type: String },
  }],
}, { collection: 'socket_presence_leases', versionKey: false, bufferCommands: false });

// Queries also exclude expired leases; reporting never depends on TTL cleanup timing.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<PresenceLease>('SocketPresenceLease', schema);
