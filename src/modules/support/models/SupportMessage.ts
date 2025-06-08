import mongoose from 'mongoose';
import { SupportType } from './Support'; 
import { UserType } from '../../auth/model/User';

export type SupportMessageType = {
  ticket: SupportType;
  user: UserType;
  message: string;
  sender: {
    fullName: string;
    avatarUrl: string;
  };
  attachments: {
    filename: string;
    url: string;
  }[];
};

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
const SupportSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Support',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    message: {
      type: String,
      required: true,
    },
    sender: {
      fullName: String,
      avatarUrl: String,
    },
    attachments: [
      {
        filename: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('SupportMessage', SupportSchema);
