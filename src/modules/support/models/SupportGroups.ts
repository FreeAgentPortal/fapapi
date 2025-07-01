import mongoose, { Mongoose } from 'mongoose';
import { SupportType } from './Support';
import { UserType } from '../../auth/model/User';

export interface SupportGroupType extends mongoose.Document {
  name: string;
  agents: UserType[];
  tickets: SupportType[];
  isActive: boolean;
}

const SupportGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    agents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    tickets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Support',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const SupportGroup = mongoose.model<SupportGroupType>('SupportGroup', SupportGroupSchema);

export default SupportGroup;
