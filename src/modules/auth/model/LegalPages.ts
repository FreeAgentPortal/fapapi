import mongoose, { Schema } from 'mongoose';
export interface LegalType extends mongoose.Document {
  type: string;
  title: string;
  content: string;
  effective_date: Date;
  version: string;
}
interface LegalAttributes extends LegalType {}

const LegalSchema = new Schema<LegalAttributes>(
  {
    type: {
      type: String,
      enum: ['terms', 'privacy', 'cookie'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    effective_date: {
      type: Date,
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<LegalType>('Legal', LegalSchema);
