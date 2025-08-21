import { Model } from 'mongoose';
import TeamModel from '../modules/profiles/team/model/TeamModel';
import { AthleteModel } from '../modules/profiles/athlete/models/AthleteModel';
import AdminModel from '../modules/profiles/admin/model/AdminModel';
import ScoutReport from '../modules/scout/models/ScoutReport';
import { ScoutModel } from '../modules/profiles/scout/model/ScoutProfile';
import { ConversationModel } from '../modules/messaging/models/Conversation';
import { MessageModel } from '../modules/messaging/models/Message';
import User from '../modules/auth/model/User';
import Token from '../modules/auth/model/TokenSchema';
import { ResumeProfile } from '../modules/profiles/resume/models/ResumeProfile';

export type ModelKey = 'team' | 'athlete' | 'admin' | 'scout_report' | 'scout_profile' | 'conversation' | 'message' | 'user' | 'token' | 'resume';

export const ModelMap: Record<ModelKey, any> = {
  team: TeamModel,
  athlete: AthleteModel,
  admin: AdminModel,
  scout_report: ScoutReport,
  scout_profile: ScoutModel,
  conversation: ConversationModel,
  message: MessageModel,
  user: User,
  token: Token,
  resume: ResumeProfile,
};
