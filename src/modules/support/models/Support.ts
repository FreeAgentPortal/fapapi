import mongoose, { Schema } from 'mongoose';
import { UserType } from '../../auth/model/User';
import { SupportGroupType } from './SupportGroups';

export interface SupportType extends mongoose.Document {
  requester: UserType;
  requesterDetails: {
    email: String;
    fullName: String;
  };
  assignee: UserType;
  groups: SupportGroupType[];
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: [string];
  tags?: string[];
  dateSolved: Date;
}
/**
 * @description Support schema for ticketing system
 * @type {Schema}
 *
 * @param {ObjectId} requester      - User who requested support
 * @param {ObjectId} assignee       - User who is assigned to the ticket
 * @param {String}   subject        - Subject of the ticket
 * @param {String}   description    - Description of the ticket
 * @param {String}   status         - Status of the ticket
 * @param {String}   priority       - Priority of the ticket
 * @param {String}   category       - Category of the ticket
 * @param {String}   subCategory    - Subcategory of the ticket
 * @param {String[]} messages       - Messages of the ticket, stored as an array of html strings.
 * @param {String}   dateSolved     - Date the ticket was solved
 *
 *
 */
interface SupportAttributes extends SupportType {}

const SupportSchema = new Schema<SupportAttributes>(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    // requester might be null if the user is not logged in, create a
    // field for the email address, fullName of the user as we will use it to query
    // for the user if they are not logged in
    // both should be here if at all possible.
    requesterDetails: {
      email: {
        type: String,
        required: false,
      },
      fullName: {
        type: String,
        required: false,
      },
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SupportGroup',
        required: false,
      },
    ],
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'Pending', 'Solved', 'New'],
      default: 'New',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low',
    },
    category: {
      // is an array of strings, as the ticket can belong to multiple categories
      type: [String],
      required: true,
    },
    dateSolved: {
      type: Date,
      required: false,
    },
    tags: {
      type: [String],
      required: false,
    },
  },
  {
    timestamps: true,
  }
);


export default mongoose.model<SupportType>('Support', SupportSchema);
