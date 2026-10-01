import { Types } from 'mongoose';

const templates = [
  {
    name: 'QB Report',
    description: 'Available Quarterbacks',
    maxAge: 41,
    positions: ['QB'],
  },
  {
    name: 'Offensive Linemen',
    description: 'Available Offensive Linemen',
    maxAge: 40,
    positions: ['OT', 'OG', 'C', 'TE'],
  },
  {
    name: 'Defensive Linemen',
    description: 'Available Defensive Linemen',
    maxAge: 40,
    positions: ['DL', 'DE', 'DT', 'NT'],
  },
  {
    name: 'Offensive Weapons',
    description: 'Offense positions inc. WR and RB',
    maxAge: 40,
    positions: ['RB', 'FB', 'WR', 'TE'],
  },
  {
    name: 'Special Teams',
    description: 'Available Special Teams players',
    maxAge: 45,
    positions: ['PR', 'KR', 'LS', 'P', 'K'],
  },
  {
    name: 'Defensive Players',
    description: 'Defensive positions off the line',
    maxAge: 40,
    positions: ['CB', 'S', 'FS', 'SS', 'OLB', 'ILB'],
  },
];

export const DEFAULT_TEAM_SEARCH_PREFERENCE_COUNT = templates.length;

/** Build fresh default preferences owned by a team profile, with no run history. */
export function buildDefaultTeamSearchPreferences(ownerId: Types.ObjectId) {
  return templates.map(template => ({
    ownerType: 'team' as const,
    ownerId,
    name: template.name,
    description: template.description,
    tags: [],
    frequency: 1,
    frequencyType: 'weekly' as const,
    ageRange: { min: 18, max: template.maxAge },
    positions: [...template.positions],
    performanceMetrics: {},
  }));
}
