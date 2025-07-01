import mongoose from 'mongoose';

export interface AdminType extends mongoose.Document {
  _id: mongoose.Schema.Types.ObjectId;
  user: mongoose.Schema.Types.ObjectId;
  roles: ('admin' | 'moderator' | 'developer' | 'support')[];
  permissions: string[]; // for fine-grained ACL
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roles: { type: [String], enum: ['admin', 'moderator', 'developer', 'support'], default: ['admin'] },
    permissions: [String], // for fine-grained ACL
  },
  {
    timestamps: true,
  }
);
export default mongoose.model<AdminType>('Admin', AdminSchema);
