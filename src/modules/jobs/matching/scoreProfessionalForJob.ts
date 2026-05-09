import { MatchInput, MatchResult } from './types';

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'with']);

type ScoreContribution = {
  points: number;
  reason: string;
};

function normalizeText(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

function tokenize(value: string | undefined | null): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function buildTokenSet(values: Array<string | undefined | null>): Set<string> {
  return new Set(values.flatMap((value) => tokenize(value)));
}

function hasPhraseMatch(source: string | undefined | null, target: string | undefined | null): boolean {
  const normalizedSource = normalizeText(source);
  const normalizedTarget = normalizeText(target);

  if (!normalizedSource || !normalizedTarget) {
    return false;
  }

  return normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource);
}

function hasMeaningfulTokenOverlap(left: string | undefined | null, right: string | undefined | null, minimumOverlap = 1): boolean {
  const leftTokens = buildTokenSet([left]);
  const rightTokens = buildTokenSet([right]);
  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap >= minimumOverlap;
}

function scoreRoleSignals(input: MatchInput): ScoreContribution[] {
  const contributions: ScoreContribution[] = [];
  const desiredRoles = input.professional.desiredRoles || [];
  const jobTitle = input.job.title;
  const department = input.job.department;

  const titleMatch = desiredRoles.some((role) => hasPhraseMatch(role, jobTitle) || hasMeaningfulTokenOverlap(role, jobTitle));
  if (titleMatch) {
    contributions.push({ points: 24, reason: 'Desired role aligns with the job title.' });
  }

  const departmentMatch = department ? desiredRoles.some((role) => hasPhraseMatch(role, department) || hasMeaningfulTokenOverlap(role, department)) : false;
  if (departmentMatch) {
    contributions.push({ points: 8, reason: 'Desired role aligns with the job department.' });
  }

  return contributions;
}

function scoreResumeSignals(input: MatchInput): ScoreContribution[] {
  const experiences = input.resume?.experiences || [];
  const jobTitle = input.job.title;

  const matchingExperience = experiences.some((experience) => hasPhraseMatch(experience.position, jobTitle) || hasMeaningfulTokenOverlap(experience.position, jobTitle));
  if (!matchingExperience) {
    return [];
  }

  return [{ points: 20, reason: 'Resume experience includes a role similar to the job title.' }];
}

function scoreLocationSignals(input: MatchInput): ScoreContribution[] {
  const jobLocation = input.job.location;
  const professionalLocation = input.professional.location;

  if (!jobLocation || !professionalLocation) {
    return [];
  }

  const sameCountry = normalizeText(jobLocation.country) && normalizeText(jobLocation.country) === normalizeText(professionalLocation.country);
  const sameState = normalizeText(jobLocation.state) && normalizeText(jobLocation.state) === normalizeText(professionalLocation.state);
  const sameCity = normalizeText(jobLocation.city) && normalizeText(jobLocation.city) === normalizeText(professionalLocation.city);

  if (sameCity && sameState && sameCountry) {
    return [{ points: 10, reason: 'Professional is in the same city as the job.' }];
  }

  if (sameState && sameCountry) {
    return [{ points: 8, reason: 'Professional is in the same state as the job.' }];
  }

  if (sameCountry) {
    return [{ points: 6, reason: 'Professional is in the same country as the job.' }];
  }

  return [];
}

function scoreWorkPreferenceSignals(input: MatchInput): ScoreContribution[] {
  if (input.job.locationType === 'remote' && input.professional.openToRemote) {
    return [{ points: 10, reason: 'Professional is open to remote work for this role.' }];
  }

  if (input.job.locationType === 'hybrid' && input.professional.openToRemote) {
    return [{ points: 6, reason: 'Professional is open to hybrid or remote work.' }];
  }

  if (input.job.locationType === 'onsite' && input.professional.openToRelocation) {
    return [{ points: 8, reason: 'Professional is open to relocating for an onsite role.' }];
  }

  return [];
}

function scoreExperienceLevelSignals(input: MatchInput): ScoreContribution[] {
  if (!input.job.experienceLevel || !input.professional.experienceLevel) {
    return [];
  }

  if (input.job.experienceLevel !== input.professional.experienceLevel) {
    return [];
  }

  return [{ points: 10, reason: 'Professional experience level matches the role.' }];
}

function scoreIndustrySignals(input: MatchInput): ScoreContribution[] {
  const jobIndustries = new Set((input.job.industries || []).map((industry) => normalizeText(industry)).filter(Boolean));
  const professionalIndustries = new Set((input.professional.industries || []).map((industry) => normalizeText(industry)).filter(Boolean));

  const overlap = [...jobIndustries].filter((industry) => professionalIndustries.has(industry));
  if (overlap.length === 0) {
    return [];
  }

  return [{ points: 8, reason: 'Professional background overlaps with the role industry.' }];
}

function scoreKeywordSignals(input: MatchInput): ScoreContribution[] {
  const requirementKeywords = buildTokenSet([...(input.job.requirements || []), ...(input.job.preferredQualifications || [])]);
  if (requirementKeywords.size === 0) {
    return [];
  }

  const candidateKeywords = buildTokenSet([
    input.professional.headline,
    input.professional.bio,
    ...(input.resume?.experiences || []).flatMap((experience) => [experience.position, experience.orgName, ...(experience.achievements || [])]),
    ...(input.resume?.awards || []).flatMap((award) => [award.title, award.org, award.description]),
    ...(input.resume?.qa || []).flatMap((entry) => [entry.question, entry.answer]),
  ]);

  const overlap = [...requirementKeywords].filter((keyword) => candidateKeywords.has(keyword));
  if (overlap.length === 0) {
    return [];
  }

  const points = Math.min(10, Math.max(4, overlap.length * 2));
  return [{ points, reason: 'Resume content matches keywords from the job requirements.' }];
}

export function scoreProfessionalForJob(input: MatchInput): MatchResult {
  const contributions = [
    ...scoreRoleSignals(input),
    ...scoreResumeSignals(input),
    ...scoreLocationSignals(input),
    ...scoreWorkPreferenceSignals(input),
    ...scoreExperienceLevelSignals(input),
    ...scoreIndustrySignals(input),
    ...scoreKeywordSignals(input),
  ];

  const score = Math.max(
    0,
    Math.min(
      100,
      contributions.reduce((total, contribution) => total + contribution.points, 0)
    )
  );
  const reasons = [...new Set(contributions.map((contribution) => contribution.reason))];

  return {
    score,
    reasons,
  };
}

export default scoreProfessionalForJob;
