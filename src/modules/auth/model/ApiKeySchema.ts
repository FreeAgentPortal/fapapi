import mongoose, { Schema, Document } from 'mongoose';

interface ApiKey extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  apiKey: string;
  isActive: boolean;
  version: string;
  createdAt: Date;
  expiresAt: Date;
  permissions: string[]; // Optional: Define the scopes/permissions associated with the key
}

const ApiKeySchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  version: { type: String, default: "v1" },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  permissions: { type: [String], default: [] }, // Optional: Define permissions
});

export default mongoose.model<ApiKey>('ApiKey', ApiKeySchema);
