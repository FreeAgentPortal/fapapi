import { Request } from 'express';
import { IAthlete, AthleteModel } from '../models/AthleteModel';
import mongoose from 'mongoose';

export interface AthleteProfileInput {
  userId: mongoose.Types.ObjectId;
  fullName: string;
  contactNumber?: string;
  email?: string;
  hometown?: string;
  birthdate?: Date;
  measurements?: Map<string, string>;
  metrics?: Map<string, number>;
  college?: string;
  position?: string;
  highSchool?: string;
  awards?: string[];
  strengths?: string;
  weaknesses?: string;
  testimony?: string;
  profileImageUrl?: string;
  highlightVideos?: string[];
}

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class AthleteProfileHandler {
  /**
   * Creates a new athlete profile for the given user.
   * @param data Athlete profile input
   * @returns The created athlete document
   */
  async createProfile(data: AthleteProfileInput): Promise<IAthlete> {
    const existing = await AthleteModel.findOne({ userId: data.userId });
    if (existing) {
      throw new Error('Athlete profile already exists for this user.');
    }

    const profile = new AthleteModel(data);
    if (!profile){
      throw new Error('Failed to create athlete profile: Invalid data provided.');
    }

    return await profile.save();
  }

  /**
   * Updates an athlete profile by user ID.
   * @param userId The associated user ID
   * @param updates Partial fields to update
   * @returns The updated athlete document
   */
  async updateProfile(userId: string, updates: Partial<IAthlete>): Promise<IAthlete | null> {
    return await AthleteModel.findOneAndUpdate({ userId }, updates, {
      new: true,
    });
  }

  /**
   * Soft deletes an athlete profile (future: implement flag-based delete).
   * @param userId The user ID linked to the athlete
   */
  async deleteProfile(userId: string): Promise<void> {
    await AthleteModel.findOneAndDelete({ userId });
  }

  /**
   * Gets an athlete profile by the associated ID.
   * @param userId The user ID linked to the athlete
   * @returns The athlete document or null
   */
  async getProfile(req: Request): Promise<IAthlete | null> {
    return await AthleteModel.findOne({ _id: req.params.id });
  }

  /**
   * Gets a public athlete profile by its ObjectId (used for frontend display).
   * @param profileId The profile’s _id
   * @returns The athlete document or null
   */
  async getPublicProfileById(profileId: string): Promise<IAthlete | null> {
    return await AthleteModel.findById(profileId);
  }

  /**
   * @description Retrieves all athlete profiles, useful for admin or public listings.
   * @returns An array of athlete profiles
   */
  async getAllProfiles(req: Request): Promise<IAthlete[]> {
    //TODO: Implement pagination and adv. filtering logic
    // For now, return all profiles
    return await AthleteModel.find({});
  }
}
