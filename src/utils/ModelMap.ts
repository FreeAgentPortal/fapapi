import { Model } from 'mongoose'; 
import TeamModel from '../modules/team/model/TeamModel';
import { AthleteModel } from '../modules/athlete/models/AthleteModel';
import AdminModel from '../modules/admin/model/AdminModel';

export const ModelMap: Record<string, Model<any>> = {
  team: TeamModel,
  athlete: AthleteModel,
  admin: AdminModel,
    // extend with other models as needed
};
