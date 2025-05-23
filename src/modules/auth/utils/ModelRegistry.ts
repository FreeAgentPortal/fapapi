// utils/ModelRegistry.ts 
import AdminModel from "../../admin/model/AdminModel";
import User from "../model/User";

 

const modelMap: Record<string, any> = {
  user: User,
  admin: AdminModel,
  // athlete: Athlete,
  // team: Team
  // add more as needed
};

export const getModelByRole = (role: string) => {
  const model = modelMap[role.toLowerCase()];
  if (!model) {
    throw new Error(`Model for role "${role}" not found in registry.`);
  }
  return model;
};
