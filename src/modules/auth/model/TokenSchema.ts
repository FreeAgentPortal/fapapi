// models/Token.ts
import mongoose, { Schema, Types, Document, Model } from 'mongoose';
import crypto from 'crypto';

type TokenType = 'PASSWORD_RESET' | 'EMAIL_VERIFY' | 'TEAM_INVITE';

interface TokenAttrs {
  type: TokenType;
  tokenHash: string; // sha256(rawToken)
  expiresAt: Date; // TTL prunes it
  consumedAt?: Date | null;

  // — Subject (polymorphic, all optional) —
  user?: Types.ObjectId | null; // for password reset / verify
  email?: string | null; // for invites before user exists
  teamProfile?: Types.ObjectId | null; // e.g., which team the invite is for
  meta?: Record<string, unknown> | null;
}

interface TokenDoc extends Document, TokenAttrs {}
interface TokenModel extends Model<TokenDoc> {
  issue(params: {
    type: TokenType;
    ttlMs?: number;
    userId?: Types.ObjectId | null;
    email?: string | null;
    teamProfileId?: Types.ObjectId | null;
    meta?: Record<string, unknown> | null;
    uniquePerSubject?: boolean; // default true
  }): Promise<{ token: string; doc: TokenDoc }>;

  validateRaw(params: { rawToken: string; type: TokenType }): Promise<TokenDoc | null>;

  consume(id: Types.ObjectId): Promise<void>;
}

/* ——— tiny pure helpers ——— */
const genToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw, 'utf8').digest('hex');

const TokenSchema = new Schema<TokenDoc, TokenModel>(
  {
    type: { type: String, required: true, enum: ['PASSWORD_RESET', 'EMAIL_VERIFY', 'TEAM_INVITE'], index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null, index: true },

    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, default: null, index: true },
    teamProfile: { type: Schema.Types.ObjectId, ref: 'TeamProfile', default: null, index: true },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false }
);

/* TTL: auto-delete after expiry */
TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* One active token per (user,type) while unconsumed */
TokenSchema.index({ type: 1, user: 1, consumedAt: 1 }, { unique: true, partialFilterExpression: { consumedAt: null, user: { $type: 'objectId' } } });

/* One active token per (email,type) while unconsumed — for invite flows */
TokenSchema.index({ type: 1, email: 1, consumedAt: 1 }, { unique: true, partialFilterExpression: { consumedAt: null, email: { $type: 'string' } } });

/* ——— statics ——— */
TokenSchema.statics.issue = async function ({
  type,
  ttlMs = 10 * 60 * 1000, // default 10 minutes
  userId = null,
  email = null,
  teamProfileId = null,
  meta = null,
  uniquePerSubject = true,
}: {
  type: TokenType;
  ttlMs?: number;
  userId?: Types.ObjectId | null;
  email?: string | null;
  teamProfileId?: Types.ObjectId | null;
  meta?: Record<string, unknown> | null;
  uniquePerSubject?: boolean;
}): Promise<{ token: string; doc: TokenDoc }> {
  // optional: enforce single active token per subject+type
  if (uniquePerSubject) {
    const filter: any = { type, consumedAt: null, expiresAt: { $gt: new Date() } };
    if (userId) filter.user = userId;
    if (email) filter.email = email;
    await this.updateMany(filter, { $set: { consumedAt: new Date() } });
  }

  const raw = genToken(32);
  const doc = await this.create({
    type,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs),
    user: userId,
    email,
    teamProfile: teamProfileId,
    meta,
  });

  return { token: raw, doc };
};

TokenSchema.statics.validateRaw = async function ({ rawToken, type }: { rawToken: string; type: TokenType }): Promise<TokenDoc | null> {
  const now = new Date();
  return this.findOne({
    type,
    tokenHash: hashToken(rawToken),
    consumedAt: null,
    expiresAt: { $gt: now },
  });
};

TokenSchema.statics.consume = async function (id: Types.ObjectId) {
  await this.updateOne({ _id: id, consumedAt: null }, { $set: { consumedAt: new Date() } });
};

export const Token = mongoose.model<TokenDoc, TokenModel>('Token', TokenSchema);
export default Token;
