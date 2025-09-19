import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';

/**
 * @description Receipt interface for transaction records
 */
export interface ReceiptType extends mongoose.Document {
  _id: ObjectId;

  // Basic transaction info
  transactionId: string; // Internal transaction ID
  billingAccountId: ObjectId;
  userId: ObjectId;

  // Transaction details
  status: 'pending' | 'success' | 'failed' | 'refunded' | 'voided';
  type: 'payment' | 'refund' | 'void';
  amount: number;
  currency: string;
  description?: string; // Optional description of what the payment was for

  // Plan information snapshot (optional - not all transactions are plan-related)
  planInfo?: {
    planId: ObjectId;
    planName: string;
    planPrice: number;
    billingCycle: 'monthly' | 'yearly';
  };

  // Payment processor info
  processor: {
    name: string;
    transactionId: string;
    response: mongoose.Schema.Types.Mixed;
  };

  // Customer info snapshot
  customer: {
    email: string;
    name: string;
    phone: string;
  };

  // Failure tracking
  failure: {
    reason: string;
    code: string;
  };

  // Audit
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Receipt mongoose schema
 */
const ReceiptSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    billingAccountId: {
      type: Types.ObjectId,
      ref: 'BillingAccount',
      required: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: 'User',
    },

    // Transaction details
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded', 'voided'],
      required: true,
      default: 'pending',
    },
    type: {
      type: String,
      enum: ['payment', 'refund', 'void'],
      required: true,
      default: 'payment',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    description: {
      type: String,
      required: false,
    },

    // Plan snapshot (optional)
    planInfo: {
      planId: { type: Types.ObjectId, ref: 'Plan' },
      planName: { type: String },
      planPrice: { type: Number },
      billingCycle: { type: String, enum: ['monthly', 'yearly'] },
    },

    // Processor info
    processor: {
      name: {
        type: String,
        required: true,
        default: 'paynetworx',
      },
      transactionId: {
        type: String,
        required: true,
      },
      response: {
        type: mongoose.Schema.Types.Mixed,
      },
    },

    customer: {
      email: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    },

    // Failure tracking
    failure: {
      reason: {
        type: String,
      },
      code: {
        type: String,
      },
    },

    // Transaction date
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'receipts',
  }
);

// Basic indexes
ReceiptSchema.index({ transactionDate: -1 });
ReceiptSchema.index({ billingAccountId: 1 });
ReceiptSchema.index({ processorTransactionId: 1 });
ReceiptSchema.index({ status: 1 });
ReceiptSchema.index({ description: 'text' }); // Text index for searching descriptions

const Receipt = mongoose.model<ReceiptType>('Receipt', ReceiptSchema);

export default Receipt;
