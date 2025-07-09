import axios from 'axios';
import dotenv from 'dotenv';
import { AthleteModel } from '../modules/athlete/models/AthleteModel';
import mongoose from 'mongoose';

dotenv.config();

const fetchAthleteList = async (url: string) => {
  const response = await axios.get(url);
  return response.data.items; // Assuming ESPN uses 'items' array
};

const fetchAthleteDetail = async (ref: string) => {
  const response = await axios.get(ref);
  return response.data;
};

const mapAthleteData = (data: any) => ({
  espnid: data.id,
  fullName: data.fullName,
  firstName: data.firstName,
  lastName: data.lastName,
  displayName: data.displayName,
  age: data.age,
  birthdate: data.dateOfBirth,
  active: data.active,
  measurements: {
    height: data.height,
    weight: data.weight,
  },
  // for testing purposes we will create a mock of metrics
  metrics: {
    // set random values so we can test the search functionality
    dash40: Math.random() * (5 - 4) + 4, //
    benchPress: Math.floor(Math.random() * (30 - 20 + 1)) + 20, // Random value between 20 and 30
    verticalJump: Math.floor(Math.random() * (40 - 30 + 1)) + 30, // Random value between 30 and 40
    broadJump: Math.floor(Math.random() * (120 - 100 + 1)) + 100, // Random value between 100 and 120
    threeCone: Math.random() * (8 - 6) + 6, // Random value between 6 and 8
    shuttle: Math.random() * (5 - 4) + 4, // Random value between 4 and 5
  },
  birthPlace: data.birthPlace,
  draft: data.draft
    ? {
        year: data.draft.year,
        round: data.draft.round,
        selection: data.draft.selection,
        displayText: data.draft.displayText,
      }
    : undefined,
  positions: {
    name: data.position?.name,
    abbreviation: data.position?.abbreviation,
  },
  experienceYears: data.experience?.years,
  profileImageUrl: data.headshot?.href,
  links: data.links?.map((link: any) => ({
    text: link.text,
    shortText: link.shortText,
    href: link.href,
    rel: link.rel,
    isExternal: link.isExternal,
  })),
});

const seedAthletes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('🔗 Connected to MongoDB');
    const list = await fetchAthleteList('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?limit=100&active=true&page=2');
    console.log(`Fetched ${list.length} athletes from ESPN API`);

    const athletes = await Promise.all(
      list.map(async (athlete: any) => {
        const detail = await fetchAthleteDetail(athlete.$ref);
        return mapAthleteData(detail);
      })
    );

    console.log(`Mapped ${athletes.length} athletes`);

    // Upsert based on espnid, if espnid exists, update the document, otherwise insert a new one
    await AthleteModel.bulkWrite(
      athletes.map((athlete) => ({
        updateOne: {
          filter: { espnid: athlete.espnid },
          update: { $set: athlete },
          upsert: true, // Insert if not exists
        },
      }))
    );
    console.log(`✅ Successfully upserted athletes`);
  } catch (error) {
    console.error('Error seeding athletes:', error);
  } finally {
    await mongoose.disconnect();
  }
};

seedAthletes().catch(console.error);
