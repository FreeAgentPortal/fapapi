import { Model } from 'mongoose';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import TeamModel from '../../team/model/TeamModel';

export const ModelMap: Record<string, Model<any>> = {
  team: TeamModel,
  athlete: AthleteModel,
  // extend with other models as needed
};
