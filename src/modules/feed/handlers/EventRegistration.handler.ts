import { CRUDHandler } from '../../../utils/baseCRUD';
import { EventRegistrationDocument, EventRegistrationModel, RegistrationStatus } from '../model/EventRegistration.model';
import { EventModel } from '../model/Event.model';
import mongoose from 'mongoose';

type ProfileType = 'athlete' | 'team' | 'agent' | 'scout' | 'media';

// Map frontend profile types to collection names
const PROFILE_COLLECTION_MAP: Record<ProfileType, string> = {
  athlete: 'AthleteProfile',
  team: 'TeamProfile',
  agent: 'AgentProfile',
  scout: 'ScoutProfile',
  media: 'MediaProfile',
};

// Map profile types to role field values
const PROFILE_ROLE_MAP: Record<ProfileType, 'athlete' | 'agent' | 'scout' | 'media'> = {
  athlete: 'athlete',
  team: 'athlete', // team registrations treated as athlete role for events
  agent: 'agent',
  scout: 'scout',
  media: 'media',
};

export class EventRegistrationHandler extends CRUDHandler<EventRegistrationDocument> {
  constructor() {
    super(EventRegistrationModel);
  }

  /**
   * Register a user for an event
   * @param userId - The user ID
   * @param eventId - The event ID
   * @param profileType - The profile type (athlete, team, agent, scout, media)
   * @param profileId - The profile ID
   * @param answers - Optional answers to registration questions
   */
  async registerForEvent(
    userId: string,
    eventId: string,
    profileType: ProfileType,
    profileId: string,
    answers?: Array<{ key: string; label: string; answer: string | number | boolean | string[] }>
  ): Promise<EventRegistrationDocument> {
    // Verify event exists
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check if user already registered
    const existingRegistration = await EventRegistrationModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (existingRegistration) {
      throw new Error('User already registered for this event');
    }

    // Map profile type to collection name
    const collection = PROFILE_COLLECTION_MAP[profileType];
    if (!collection) {
      throw new Error(`Invalid profile type: ${profileType}`);
    }

    // Map profile type to role
    const role = PROFILE_ROLE_MAP[profileType];

    // Validate answers if event has required questions
    if (event.registration?.required && event.registration.questions) {
      const requiredQuestions = event.registration.questions.filter((q: any) => q.required);
      const answeredKeys = new Set(answers?.map((a) => a.key) || []);

      for (const question of requiredQuestions) {
        if (!answeredKeys.has(question.key)) {
          throw new Error(`Required question not answered: ${question.label}`);
        }
      }
    }

    // Create registration with INTERESTED status
    const registration = await EventRegistrationModel.create({
      eventId: new mongoose.Types.ObjectId(eventId),
      userId: new mongoose.Types.ObjectId(userId),
      profileId: {
        collection: collection as any,
        id: new mongoose.Types.ObjectId(profileId),
      },
      role: role,
      status: answers && answers.length > 0 ? RegistrationStatus.APPLIED : RegistrationStatus.INTERESTED,
      answers: answers || [],
    });

    return registration;
  }

  /**
   * Update registration status (for event organizers)
   */
  async updateRegistrationStatus(registrantId: string, newStatus: RegistrationStatus): Promise<EventRegistrationDocument | null> {
    const registration = await EventRegistrationModel.findOneAndUpdate({ 'profile.id': registrantId }, { status: newStatus }, { new: true });

    return registration;
  }

  /**
   * Get all registrations for an event
   */
  async getEventRegistrations(eventId: string, status?: RegistrationStatus): Promise<EventRegistrationDocument[]> {
    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (status) {
      query.status = status;
    }

    const registrations = await EventRegistrationModel.find(query).sort({ createdAt: -1 }).lean();

    // Inflate profile objects for each registration
    await this.inflateRegistrationProfiles(registrations);
    return registrations as any;
  }

  /**
   * Inflate profile objects for registrations
   */
  private async inflateRegistrationProfiles(registrations: any[]): Promise<void> {
    // Group registrations by profile collection for batch lookups
    const collectionGroups = new Map<string, any[]>();

    for (const registration of registrations) {
      if (!registration.profileId?.collection || !registration.profileId?.id) continue;

      const collection = registration.profileId.collection;
      if (!collectionGroups.has(collection)) {
        collectionGroups.set(collection, []);
      }
      collectionGroups.get(collection)!.push(registration);
    }

    // Perform batch lookups for each collection
    for (const [collection, groupRegistrations] of collectionGroups) {
      const ids = groupRegistrations.map((r) => r.profileId.id);

      try {
        // Map collection to MongoDB collection name
        const collectionMap: Record<string, string> = {
          AthleteProfile: 'athleteprofiles',
          TeamProfile: 'teamprofiles',
          AgentProfile: 'agentprofiles',
          ScoutProfile: 'scoutprofiles',
          MediaProfile: 'mediaprofiles',
        };

        const collectionName = collectionMap[collection];
        if (!collectionName) {
          console.warn(`Unknown profile collection: "${collection}"`);
          continue;
        }

        // Direct collection access for batch fetch
        const db = mongoose.connection.db;
        if (!db) continue;

        const profileCollection = db.collection(collectionName);
        const profiles = await profileCollection
          .find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }, { projection: { _id: 1, fullName: 1, email: 1, profileImageUrl: 1, name: 1, logoUrl: 1 } })
          .toArray();

        // Create a map for quick lookup
        const profileMap = new Map(profiles.map((profile: any) => [profile._id.toString(), profile]));

        // Attach profiles to registrations
        for (const registration of groupRegistrations) {
          const profile = profileMap.get(registration.profileId.id.toString());
          if (profile) {
            // Map team-specific fields to standard fields
            if (profile.name) {
              profile.fullName = profile.name;
            }
            if (profile.logoUrl) {
              profile.profileImageUrl = profile.logoUrl;
            }
            registration.profile = profile;
          }
        }
      } catch (error) {
        console.error(`Failed to inflate profiles from collection "${collection}":`, error);
      }
    }
  }

  /**
   * Get user's registration for an event
   */
  async getUserRegistration(userId: string, eventId: string): Promise<EventRegistrationDocument | null> {
    const registration = await EventRegistrationModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      eventId: new mongoose.Types.ObjectId(eventId),
    }).lean();

    return registration as EventRegistrationDocument | null;
  }

  /**
   * Cancel/withdraw registration
   */
  async cancelRegistration(userId: string, eventId: string): Promise<EventRegistrationDocument | null> {
    const registration = await EventRegistrationModel.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { status: RegistrationStatus.DECLINED },
      { new: true }
    );

    return registration;
  }

  /**
   * Get registration count for an event by status
   */
  async getRegistrationCount(eventId: string, status?: RegistrationStatus): Promise<number> {
    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (status) {
      query.status = status;
    }

    return await EventRegistrationModel.countDocuments(query);
  }
}
