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
  fullName: data.fullName,
  firstName: data.firstName,
  lastName: data.lastName,
  displayName: data.displayName,
  age: data.age,
  dateOfBirth: data.dateOfBirth,
  active: data.active,
  metrics: {
    height: data.height,
    weight: data.weight,
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
  position: {
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
    const list = await fetchAthleteList('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?limit=100&active=true');
    console.log(`Fetched ${list.length} athletes from ESPN API`);

    const athletes = await Promise.all(
      list.map(async (athlete: any) => {
        const detail = await fetchAthleteDetail(athlete.$ref);
        return mapAthleteData(detail);
      })
    );

    console.log(`Mapped ${athletes.length} athletes`);
    // delete all existing athletes
    await AthleteModel.deleteMany({});
    console.log('✅ Deleted all existing athletes');
    const result = await AthleteModel.insertMany(athletes);
    console.log(`✅ Successfully inserted ${result.length} athletes`);
    console.log(`Seeded ${athletes.length} athletes`);
  } catch (error) {
    console.error('Error seeding athletes:', error);
  } finally {
    await mongoose.disconnect();
  }
};

seedAthletes().catch(console.error);
