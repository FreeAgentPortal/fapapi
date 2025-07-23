import mongoose from 'mongoose';

export interface AdminType extends mongoose.Document {
  _id: mongoose.Schema.Types.ObjectId;
  user: mongoose.Schema.Types.ObjectId;
  roles: ('admin' | 'scout' | 'developer' | 'support' | 'agent')[];
  permissions: string[]; // for fine-grained ACL
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roles: { type: [String], enum: ['admin', 'scout', 'developer', 'support', 'agent'] },
    permissions: [String], // for fine-grained ACL
  },
  {
    timestamps: true,
  }
);
export default mongoose.model<AdminType>('Admin', AdminSchema);
