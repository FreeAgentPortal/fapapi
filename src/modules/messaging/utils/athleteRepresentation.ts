type AthleteRepresentative = {
  status?: string;
  profile?: unknown;
  name?: string;
  email?: string;
  phone?: string;
};

export function getAthleteRepresentative(agent?: AthleteRepresentative | null) {
  if (!agent || agent.status === 'removed' || agent.status === 'invited') return undefined;
  return agent.status === 'active' || agent.name || agent.email || agent.phone ? agent : undefined;
}
