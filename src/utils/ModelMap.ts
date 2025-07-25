import { Model } from 'mongoose';
import TeamModel from '../modules/profiles/team/model/TeamModel';
import { AthleteModel } from '../modules/profiles/athlete/models/AthleteModel';
import AdminModel from '../modules/profiles/admin/model/AdminModel';
import ScoutReport from '../modules/scout/models/ScoutReport';

export const ModelMap: Record<string, Model<any>> = {
  team: TeamModel,
  athlete: AthleteModel,
  admin: AdminModel,
  scout_report: ScoutReport,
  // extend with other models as needed
};
