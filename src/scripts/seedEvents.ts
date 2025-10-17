import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EventModel, EventType, Visibility, Audience, LocationKind } from '../modules/feed/model/Event.model';

dotenv.config();

const TEAM_ID = '689d181baa65c421d7d9d70d';
const USER_ID = '6841d605501c52c46ca29501';

const seedEvents = async () => {
  try {
    // Connect to database using the same format as other scripts
    const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.CLUSTER_STRING}/?retryWrites=true&w=majority`;
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DBNAME,
    });
    console.info('🔗 Connected to MongoDB');

    // Helper function to generate random dates
    const getRandomDate = (daysOffset: number, hourVariation: number = 24) => {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + daysOffset);
      baseDate.setHours(Math.floor(Math.random() * hourVariation), Math.floor(Math.random() * 60), 0, 0);
      return baseDate;
    };

    // Helper function to get end date (1-4 hours after start)
    const getEndDate = (startDate: Date) => {
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + Math.floor(Math.random() * 3) + 1);
      return endDate;
    };

    // Sample locations
    const physicalLocations = [
      {
        venueName: 'Lincoln High School Stadium',
        addressLine1: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
        geo: { type: 'Point' as const, coordinates: [-89.6501, 39.7817] },
      },
      {
        venueName: 'Central Park Athletic Complex',
        addressLine1: '456 Oak Avenue',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62702',
        country: 'US',
        geo: { type: 'Point' as const, coordinates: [-89.64, 39.79] },
      },
      {
        venueName: 'Riverside Sports Center',
        addressLine1: '789 River Road',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62703',
        country: 'US',
        geo: { type: 'Point' as const, coordinates: [-89.63, 39.8] },
      },
    ];

    const virtualLocations = [
      {
        meetingUrl: 'https://zoom.us/j/123456789',
        platform: 'Zoom',
        passcode: 'sports2024',
      },
      {
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/...',
        platform: 'Microsoft Teams',
      },
    ];

    // Sample opponents
    const opponents = [
      { name: 'Springfield Tigers (Varsity)', level: 'HS Varsity' },
      { name: 'Central Valley Eagles', level: 'HS JV' },
      { name: 'Westfield Wildcats', level: 'HS Varsity' },
      { name: 'Northside Bulldogs', level: 'HS Varsity' },
      { name: 'Eastside Panthers', level: 'HS JV' },
    ];

    const events = [];

    // Generate TRYOUT events (15 events)
    for (let i = 0; i < 15; i++) {
      const isPast = i < 5;
      const isPresent = i >= 5 && i < 8;
      const isScheduled = i >= 8;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 30) - 1); // 1-30 days ago
        status = Math.random() > 0.2 ? 'completed' : 'canceled';
      } else if (isPresent) {
        startDate = getRandomDate(0); // Today
        status = 'active';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 60) + 1); // 1-60 days from now
        status = 'scheduled';
      }

      const location =
        Math.random() > 0.8
          ? { kind: LocationKind.VIRTUAL, virtual: virtualLocations[Math.floor(Math.random() * virtualLocations.length)] }
          : { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] };

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.TRYOUT,
        sport: 'football',
        title: `Football Tryouts - ${isPresent ? 'Today' : isPast ? 'Past Session' : 'Upcoming Session'} #${i + 1}`,
        description: `Open tryouts for all positions. Bring your own equipment and be ready to showcase your skills.`,
        audience: Audience.ATHLETES,
        visibility: Visibility.PUBLIC,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location,
        registration: {
          required: true,
          opensAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
          closesAt: new Date(startDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
          capacity: 50,
          waitlistEnabled: true,
          allowWalkIns: false,
          price: 0,
          currency: 'USD',
          questions: [
            { key: 'position', label: 'Primary Position', type: 'singleSelect', required: true, options: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'] },
            { key: 'experience', label: 'Years of Experience', type: 'number', required: true, options: [] },
          ],
        },
        eligibility: {
          ageRange: { min: 14, max: 18 },
          tags: ['high-school', 'football'],
          verifiedOnly: false,
        },
        tags: ['tryouts', 'football', 'recruitment'],
      });
    }

    // Generate PRACTICE events (15 events)
    for (let i = 0; i < 15; i++) {
      const isPast = i < 6;
      const isPresent = i >= 6 && i < 9;
      const isScheduled = i >= 9;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 20) - 1);
        status = Math.random() > 0.1 ? 'completed' : 'canceled';
      } else if (isPresent) {
        startDate = getRandomDate(0);
        status = 'active';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 30) + 1);
        status = 'scheduled';
      }

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.PRACTICE,
        sport: 'football',
        title: `Team Practice - ${isPast ? 'Session' : isPresent ? 'Current' : 'Scheduled'} #${i + 1}`,
        description: `Regular team practice focusing on fundamentals, plays, and conditioning.`,
        audience: Audience.ATHLETES,
        visibility: Visibility.TEAM,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        roster: {
          maxParticipants: 35,
        },
        tags: ['practice', 'football', 'team-only'],
      });
    }

    // Generate GAME events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isPresent = i >= 4 && i < 6;
      const isScheduled = i >= 6;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 45) - 1);
        status = Math.random() > 0.05 ? 'completed' : 'postponed';
      } else if (isPresent) {
        startDate = getRandomDate(0);
        status = 'active';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 90) + 1);
        status = 'scheduled';
      }

      const opponent = opponents[Math.floor(Math.random() * opponents.length)];

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.GAME,
        sport: 'football',
        title: `vs ${opponent.name}`,
        description: `${opponent.level} football game. Come support the team!`,
        audience: Audience.ALL,
        visibility: Visibility.PUBLIC,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        opponents: [opponent],
        media: [{ kind: 'image', url: 'https://example.com/game-poster.jpg', title: 'Game Poster' }],
        tags: ['game', 'football', 'competition'],
      });
    }

    // Generate SCRIMMAGE events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isPresent = i >= 4 && i < 6;
      const isScheduled = i >= 6;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 30) - 1);
        status = 'completed';
      } else if (isPresent) {
        startDate = getRandomDate(0);
        status = 'active';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 45) + 1);
        status = 'scheduled';
      }

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.SCRIMMAGE,
        sport: 'football',
        title: `Scrimmage Session #${i + 1}`,
        description: `Controlled scrimmage to practice game situations in a low-pressure environment.`,
        audience: Audience.ATHLETES,
        visibility: Visibility.TEAM,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        tags: ['scrimmage', 'football', 'practice-game'],
      });
    }

    // Generate CAMP events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isScheduled = i >= 4;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 60) - 7);
        status = 'completed';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 120) + 14);
        status = 'scheduled';
      }

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.CAMP,
        sport: 'football',
        title: `${isPast ? 'Summer' : 'Upcoming'} Football Camp - Week ${i + 1}`,
        description: `Intensive football camp focusing on skill development, team building, and athletic conditioning.`,
        audience: Audience.ATHLETES,
        visibility: Visibility.PUBLIC,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        allDay: true,
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        registration: {
          required: true,
          opensAt: new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          closesAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          capacity: 60,
          waitlistEnabled: true,
          allowWalkIns: false,
          price: 150,
          currency: 'USD',
          questions: [
            { key: 'dietary_restrictions', label: 'Dietary Restrictions', type: 'longText', required: false, options: [] },
            { key: 'emergency_contact', label: 'Emergency Contact', type: 'shortText', required: true, options: [] },
          ],
        },
        tags: ['camp', 'football', 'intensive-training'],
      });
    }

    // Generate COMBINE events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isScheduled = i >= 4;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 90) - 7);
        status = 'completed';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 180) + 30);
        status = 'scheduled';
      }

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.COMBINE,
        sport: 'football',
        title: `Football Combine #${i + 1}`,
        description: `Professional-style combine testing including 40-yard dash, bench press, vertical jump, and position-specific drills.`,
        audience: Audience.ALL,
        visibility: Visibility.PUBLIC,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        registration: {
          required: true,
          opensAt: new Date(startDate.getTime() - 45 * 24 * 60 * 60 * 1000),
          closesAt: new Date(startDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          capacity: 100,
          waitlistEnabled: true,
          allowWalkIns: false,
          price: 75,
          currency: 'USD',
          questions: [
            { key: 'height_weight', label: 'Height and Weight', type: 'shortText', required: true, options: [] },
            { key: 'forty_time', label: 'Personal Best 40-yard time', type: 'shortText', required: false, options: [] },
          ],
        },
        eligibility: {
          ageRange: { min: 16, max: 22 },
          verifiedOnly: true,
          tags: ['combine-eligible'],
        },
        tags: ['combine', 'football', 'testing', 'recruitment'],
      });
    }

    // Generate SHOWCASE events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isScheduled = i >= 4;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 60) - 7);
        status = 'completed';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 150) + 21);
        status = 'scheduled';
      }

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.SHOWCASE,
        sport: 'football',
        title: `Talent Showcase Event #${i + 1}`,
        description: `Showcase event for talented athletes to demonstrate their skills in front of scouts and college recruiters.`,
        audience: Audience.ALL,
        visibility: Visibility.PUBLIC,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        registration: {
          required: true,
          opensAt: new Date(startDate.getTime() - 60 * 24 * 60 * 60 * 1000),
          closesAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          capacity: 80,
          waitlistEnabled: true,
          allowWalkIns: false,
          price: 200,
          currency: 'USD',
          questions: [
            { key: 'highlight_video', label: 'Highlight Video URL', type: 'url', required: false, options: [] },
            { key: 'college_interest', label: 'College Programs of Interest', type: 'longText', required: false, options: [] },
          ],
        },
        eligibility: {
          ageRange: { min: 15, max: 19 },
          diamondMin: 3,
          verifiedOnly: true,
          tags: ['showcase-eligible', 'high-potential'],
        },
        tags: ['showcase', 'football', 'recruitment', 'college-prep'],
      });
    }

    // Generate WORKOUT events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isPresent = i >= 4 && i < 6;
      const isScheduled = i >= 6;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 14) - 1);
        status = 'completed';
      } else if (isPresent) {
        startDate = getRandomDate(0);
        status = 'active';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 21) + 1);
        status = 'scheduled';
      }

      const isVirtual = Math.random() > 0.7;

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.WORKOUT,
        sport: 'football',
        title: `${isVirtual ? 'Virtual' : 'Team'} Workout Session #${i + 1}`,
        description: `${isVirtual ? 'Virtual training session with live coaching' : 'In-person conditioning and strength training session'}.`,
        audience: Audience.ATHLETES,
        visibility: Visibility.TEAM,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: isVirtual
          ? { kind: LocationKind.VIRTUAL, virtual: virtualLocations[Math.floor(Math.random() * virtualLocations.length)] }
          : { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        roster: {
          maxParticipants: isVirtual ? 50 : 25,
        },
        tags: ['workout', 'football', 'conditioning', isVirtual ? 'virtual' : 'in-person'],
      });
    }

    // Generate MEETING events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isPresent = i >= 4 && i < 6;
      const isScheduled = i >= 6;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 21) - 1);
        status = 'completed';
      } else if (isPresent) {
        startDate = getRandomDate(0);
        status = 'active';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 28) + 1);
        status = 'scheduled';
      }

      const meetingTypes = ['Team Meeting', 'Parent Meeting', 'Strategy Session', 'Film Review', 'Rules Meeting'];
      const meetingType = meetingTypes[Math.floor(Math.random() * meetingTypes.length)];

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.MEETING,
        sport: 'football',
        title: `${meetingType} #${i + 1}`,
        description: `Important team meeting to discuss strategy, rules, and upcoming events.`,
        audience: meetingType === 'Parent Meeting' ? Audience.ALL : Audience.ATHLETES,
        visibility: Visibility.TEAM,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location:
          Math.random() > 0.5
            ? { kind: LocationKind.VIRTUAL, virtual: virtualLocations[Math.floor(Math.random() * virtualLocations.length)] }
            : { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        tags: ['meeting', 'football', 'team-communication'],
      });
    }

    // Generate OTHER events (12 events)
    for (let i = 0; i < 12; i++) {
      const isPast = i < 4;
      const isScheduled = i >= 4;

      let startDate: Date;
      let status: string;

      if (isPast) {
        startDate = getRandomDate(-Math.floor(Math.random() * 45) - 1);
        status = 'completed';
      } else {
        startDate = getRandomDate(Math.floor(Math.random() * 60) + 7);
        status = 'scheduled';
      }

      const otherEventTypes = ['Team Banquet', 'Equipment Fitting', 'Photo Day', 'Community Service', 'Fundraiser'];
      const eventType = otherEventTypes[Math.floor(Math.random() * otherEventTypes.length)];

      events.push({
        teamProfileId: new mongoose.Types.ObjectId(TEAM_ID),
        createdByUserId: new mongoose.Types.ObjectId(USER_ID),
        type: EventType.OTHER,
        sport: 'football',
        title: `${eventType} #${i + 1}`,
        description: `Special team event: ${eventType}. Details will be provided closer to the date.`,
        audience: eventType === 'Team Banquet' ? Audience.ALL : Audience.ATHLETES,
        visibility: Visibility.PUBLIC,
        status,
        timezone: 'America/Chicago',
        startsAt: startDate,
        endsAt: getEndDate(startDate),
        location: { kind: LocationKind.PHYSICAL, physical: physicalLocations[Math.floor(Math.random() * physicalLocations.length)] },
        tags: ['special-event', 'football', 'team-building'],
      });
    }

    // Insert all events
    console.info(`🌱 Inserting ${events.length} events...`);
    await EventModel.insertMany(events);
    console.info('✅ Event seed complete');
    console.info(`📊 Generated events by type:`);
    console.info(`  - Tryouts: 15 events`);
    console.info(`  - Practices: 15 events`);
    console.info(`  - Games: 12 events`);
    console.info(`  - Scrimmages: 12 events`);
    console.info(`  - Camps: 12 events`);
    console.info(`  - Combines: 12 events`);
    console.info(`  - Showcases: 12 events`);
    console.info(`  - Workouts: 12 events`);
    console.info(`  - Meetings: 12 events`);
    console.info(`  - Other: 12 events`);
    console.info(`📈 Total: ${events.length} events for team ${TEAM_ID}`);
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await mongoose.disconnect();
    console.info('🔌 Disconnected from MongoDB');
  }
};

// Run the seeder
seedEvents();
