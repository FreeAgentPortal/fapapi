import { Request } from 'express';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import TeamModel, { ITeamProfile } from '../model/TeamModel';

export default class AuthenticationHandler {
  /**
   * @description This method checks if a resource exists in the database from some metric in the request
   *              i.e. { email: 'someemail@test.com' } => checks if a resource with that email exists
   * @param {Request} req - The request object containing the resource to check
   * @return {Promise<boolean>} - Returns true if the resource exists, false otherwise
   * @throws {Error} - Throws an error if the request is malformed or if the resource cannot be checked
   */
  async checkResourceExists(req: Request): Promise<boolean> {
    const { resource } = req.query as { resource?: Record<string, string> };
    // we will get a query parameter resource that will be an array of key-value pairs
    // i.e. ?resource[email]=someemail@test.com&resource[username]=someusername
    const resourceQuery = req.query.resource;

    if (!resourceQuery || typeof resourceQuery !== 'object') {
      throw new Error('Missing or invalid resource query');
    }

    const entries = Object.entries(resourceQuery);
    if (entries.length === 0) {
      throw new Error('No search criteria provided');
    }

    // Build $or condition array
    const orConditions = entries.map(([key, value]) => ({
      [key]: value,
    }));

    // Execute query
    const existing = await TeamModel.findOne({ $or: orConditions }).lean().exec();
    return !!existing;
  }
}
