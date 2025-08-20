// models/ResumeProfile.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IResumeProfile extends Document {
  _id: Types.ObjectId;
  athleteId: Types.ObjectId;                // ref AthleteProfile
  experiences: IExperience[];
  education: IEducation[];
  awards: IAward[];
  qa: IQA[];                                // general Q&A (“basic questions”)
  references: IReference[];
  media: IMedia[];
  visibility: 'public' | 'private' | 'link';
  version: number;                          // increment on each major edit
  updatedAt: Date;                          // auto-managed by Mongoose
  createdAt: Date;                          // auto-managed by Mongoose
}

export interface IExperience {
  _id: Types.ObjectId;
  orgName: string;                          // team/club/school
  league?: string;                          // NFL, NCAA DII, JUCO, etc.
  level?: 'Pro' | 'College' | 'HighSchool' | 'Club' | 'Other';
  position?: string;
  location?: { city?: string; state?: string; country?: string };
  startDate?: Date;
  endDate?: Date;                           // null/undefined = present
  achievements?: string[];                  // bullets
  stats?: Record<string, number | string>;  // flexible per sport
  media?: IMedia[];                         // links to highlight clips, images
}

export interface IEducation {
  _id: Types.ObjectId;
  school: string;
  degreeOrProgram?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

export interface IAward {
  _id: Types.ObjectId;
  title: string;                            // “All-Conference”, “MVP”
  org?: string;                             // who issued it
  year?: number;
  description?: string;
}

export interface IQA {
  _id: Types.ObjectId;
  promptId: string;                          // stable ID for a question
  question: string;
  answer: string;
}

export interface IReference {
  _id: Types.ObjectId;
  name: string;
  role?: string;                             // coach, trainer, etc.
  organization?: string;
  contact?: { email?: string; phone?: string };
}

export interface IMedia {
  _id: Types.ObjectId;
  kind: 'video' | 'image' | 'link';
  url: string;
  label?: string;
}

const MediaSchema = new Schema<IMedia>({
  kind: { type: String, enum: ['video', 'image', 'link'], required: true },
  url:  { type: String, required: true, trim: true },
  label:{ type: String, trim: true }
}, { _id: true });

const ExperienceSchema = new Schema<IExperience>({
  orgName:    { type: String, required: true, trim: true },
  league:     { type: String, trim: true },
  level:      { type: String, enum: ['Pro','College','HighSchool','Club','Other'] },
  position:   { type: String, trim: true },
  location:   { city: String, state: String, country: String },
  startDate:  { type: Date },
  endDate:    { type: Date },
  achievements: [{ type: String, trim: true }],
  stats:      { type: Schema.Types.Mixed, default: {} }, // flexible
  media:      { type: [MediaSchema], default: [] },
}, { _id: true });

const EducationSchema = new Schema<IEducation>({
  school:  { type: String, required: true, trim: true },
  degreeOrProgram: { type: String, trim: true },
  startDate: { type: Date },
  endDate:   { type: Date },
  notes:     { type: String, trim: true },
}, { _id: true });

const AwardSchema = new Schema<IAward>({
  title:       { type: String, required: true, trim: true },
  org:         { type: String, trim: true },
  year:        { type: Number },
  description: { type: String, trim: true },
}, { _id: true });

const QASchema = new Schema<IQA>({
  promptId: { type: String, required: true }, // lets you update wording safely
  question: { type: String, required: true },
  answer:   { type: String, required: true },
}, { _id: true });

const ReferenceSchema = new Schema<IReference>({
  name:  { type: String, required: true, trim: true },
  role:  { type: String, trim: true },
  organization: { type: String, trim: true },
  contact: {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
}, { _id: true });

const ResumeProfileSchema = new Schema<IResumeProfile>({
  athleteId:  { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true, index: true, unique: true },
  experiences:{ type: [ExperienceSchema], default: [] },
  education:  { type: [EducationSchema], default: [] },
  awards:     { type: [AwardSchema], default: [] },
  qa:         { type: [QASchema], default: [] },
  references: { type: [ReferenceSchema], default: [] },
  media:      { type: [MediaSchema], default: [] },
  visibility: { type: String, enum: ['public','private','link'], default: 'public' },
  version:    { type: Number, default: 1 },
}, { timestamps: true });

ResumeProfileSchema.index({ 'experiences.orgName': 'text', 'experiences.position': 'text', 'awards.title': 'text' });

export const ResumeProfile = mongoose.model<IResumeProfile>('ResumeProfile', ResumeProfileSchema);
