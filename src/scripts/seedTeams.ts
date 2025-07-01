import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TeamModel from '../modules/team/model/TeamModel';

dotenv.config();

const seedTeams = async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('🔗 Connected to MongoDB');
  // make a request to https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams to get a list of the NFL teams
  const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
  const data = await response.json();
  const teams = data.sports[0].leagues[0].teams;

  const seedData = teams.map((team: any) => ({
    name: team.team.name,
    fullName: team.team.displayName,
    location: team.team.location,
    verifiedDomain: null, // Optional field, can be set later
    openToTryouts: true, // Default value
    slug: team.team.slug,
    abbreviation: team.team.abbreviation,
    shortDisplayName: team.team.shortDisplayName,
    color: `#${team.team.color}`,
    alternateColor: `#${team.team.alternateColor}` || null, // Optional field
    isActive: true, // Default value
    isAllStar: false, // Default value
    logos: team.team.logos.map((logo: any) => ({
      href: logo.href,
      alt: logo.alt,
      width: logo.width,
      height: logo.height,
    })),
    links: team.team.links.map((link: any) => ({
      // has language, href, text, shortText
      href: link.href,
      text: link.text,
      shortText: link.shortText,
      language: link.language || 'en', // Default to 'en' if no language is provided
    })),
  }));

  try {
    await TeamModel.deleteMany(); // Optional: wipe before seeding
    await TeamModel.insertMany(seedData);
    console.log('✅ Team seed complete');
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await mongoose.disconnect();
  }
};

seedTeams();
