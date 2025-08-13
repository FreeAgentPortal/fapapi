import { Model } from 'mongoose';
import TeamModel from '../modules/profiles/team/model/TeamModel';
import { AthleteModel } from '../modules/profiles/athlete/models/AthleteModel';
import AdminModel from '../modules/profiles/admin/model/AdminModel';
import ScoutReport from '../modules/scout/models/ScoutReport';
import { ScoutModel } from '../modules/profiles/scout/model/ScoutProfile';
import { ConversationModel } from '../modules/messaging/models/Conversation';
import { MessageModel } from '../modules/messaging/models/Message';
import User from '../modules/auth/model/User';

export const ModelMap: Record<string, Model<any>> = {
  team: TeamModel,
  athlete: AthleteModel,
  admin: AdminModel,
  scout_report: ScoutReport,
  scout_profile: ScoutModel,
  conversation: ConversationModel,
  message: MessageModel,
  user: User
  // extend with other models as needed
};
