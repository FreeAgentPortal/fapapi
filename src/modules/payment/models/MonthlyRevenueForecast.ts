import mongoose from 'mongoose';
import type { StoredMonthlyForecast } from '../utils/monthlyRevenueForecast';

const schema = new mongoose.Schema<StoredMonthlyForecast>({
  _id: { type: String, required: true },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  currency: { type: String, required: true, enum: ['USD'] },
  timezone: { type: String, required: true, enum: ['UTC'] },
  capturedAt: { type: Date, required: true },
  calculationVersion: { type: Number, required: true },
  source: { type: String, required: true, enum: ['month_boundary', 'receipt_backfill', 'mid_month_initialization'] },
  contracted: { type: Number, required: true, min: 0 },
  collectible: { type: Number, required: true, min: 0 },
  atRisk: { type: Number, required: true, min: 0 },
  charges: { type: Number, required: true, min: 0 },
}, { versionKey: false });

// The deterministic _id provides uniqueness without a separate index migration.
export default mongoose.model<StoredMonthlyForecast>('MonthlyRevenueForecast', schema);
