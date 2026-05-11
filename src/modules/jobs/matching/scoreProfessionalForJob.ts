import { MatchInput, MatchResult } from './types';

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'with']);

type ScoreContribution = {
  points: number;
  reason: string;
};

type SignalEvaluation = {
  signal: string;
  contributions: ScoreContribution[];
  diagnostics: Record<string, unknown>;
};

type MatchLoggingSummary = {
  professionalId: string | null;
  jobTitle: string | null;
  department: string | null;
  locationType: MatchInput['job']['locationType'] | null;
  score: number;
  reasons: string[];
  inputSnapshot: {
    desiredRoleCount: number;
    industryCount: number;
    experienceCount: number;
    awardCount: number;
    qaCount: number;
    hasHeadline: boolean;
    hasBio: boolean;
  };
  signals: Array<{
    signal: string;
    awardedPoints: number;
    reasons: string[];
    diagnostics: Record<string, unknown>;
  }>;
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

function getSetOverlap(left: Set<string>, right: Set<string>): string[] {
  const overlap: string[] = [];

  for (const value of left) {
    if (right.has(value)) {
      overlap.push(value);
    }
  }

  return overlap;
}

function getTokenOverlap(left: string | undefined | null, right: string | undefined | null): string[] {
  return getSetOverlap(buildTokenSet([left]), buildTokenSet([right]));
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
  return getTokenOverlap(left, right).length >= minimumOverlap;
}

function hasMeaningfulTextMatch(left: string | undefined | null, right: string | undefined | null, minimumOverlap = 1): boolean {
  return hasPhraseMatch(left, right) || hasMeaningfulTokenOverlap(left, right, minimumOverlap);
}

function sampleValues(values: Iterable<string | undefined | null>, limit = 8): string[] {
  const sample: string[] = [];

  for (const value of values) {
    const trimmedValue = typeof value === 'string' ? value.trim() : '';

    if (!trimmedValue) {
      continue;
    }

    sample.push(trimmedValue);

    if (sample.length >= limit) {
      break;
    }
  }

  return sample;
}

function sumContributionPoints(contributions: ScoreContribution[]): number {
  return contributions.reduce((total, contribution) => total + contribution.points, 0);
}

function buildLocationSnapshot(location: { city?: string | null; state?: string | null; country?: string | null } | undefined | null): {
  city: string | null;
  state: string | null;
  country: string | null;
} | null {
  if (!location) {
    return null;
  }

  return {
    city: normalizeText(location.city) || null,
    state: normalizeText(location.state) || null,
    country: normalizeText(location.country) || null,
  };
}

function isMatchScoringDebugEnabled(): boolean {
  const flag = normalizeText(process.env.MATCH_SCORING_DEBUG);
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function logScoreEvaluation(input: MatchInput, evaluations: SignalEvaluation[], score: number, reasons: string[]): void {
  if (score > 0 && !isMatchScoringDebugEnabled()) {
    return;
  }

  const summary: MatchLoggingSummary = {
    professionalId: input.professional._id ? String(input.professional._id) : null,
    jobTitle: input.job.title || null,
    department: input.job.department || null,
    locationType: input.job.locationType || null,
    score,
    reasons,
    inputSnapshot: {
      desiredRoleCount: input.professional.desiredRoles?.length || 0,
      industryCount: input.professional.industries?.length || 0,
      experienceCount: input.resume?.experiences?.length || 0,
      awardCount: input.resume?.awards?.length || 0,
      qaCount: input.resume?.qa?.length || 0,
      hasHeadline: Boolean(normalizeText(input.professional.headline)),
      hasBio: Boolean(normalizeText(input.professional.bio)),
    },
    signals: evaluations.map((evaluation) => ({
      signal: evaluation.signal,
      awardedPoints: sumContributionPoints(evaluation.contributions),
      reasons: evaluation.contributions.map((contribution) => contribution.reason),
      diagnostics: evaluation.diagnostics,
    })),
  };

  if (score === 0) {
    console.warn('[jobs.matching] scoreProfessionalForJob returned zero score', summary);
    return;
  }

  console.info('[jobs.matching] scoreProfessionalForJob evaluation', summary);
}

function scoreRoleSignals(input: MatchInput): SignalEvaluation {
  const contributions: ScoreContribution[] = [];
  const desiredRoles = input.professional.desiredRoles || [];
  const jobTitle = input.job.title;
  const department = input.job.department;

  const titleMatches = desiredRoles.filter((role) => hasMeaningfulTextMatch(role, jobTitle));
  if (titleMatches.length > 0) {
    contributions.push({ points: 24, reason: 'Desired role aligns with the job title.' });
  }

  const departmentMatches = department ? desiredRoles.filter((role) => hasMeaningfulTextMatch(role, department)) : [];
  if (departmentMatches.length > 0) {
    contributions.push({ points: 8, reason: 'Desired role aligns with the job department.' });
  }

  return {
    signal: 'role',
    contributions,
    diagnostics: {
      desiredRoleCount: desiredRoles.length,
      desiredRoleSample: sampleValues(desiredRoles),
      jobTitle: jobTitle || null,
      department: department || null,
      titleMatches: sampleValues(titleMatches),
      departmentMatches: sampleValues(departmentMatches),
    },
  };
}

function scoreResumeSignals(input: MatchInput): SignalEvaluation {
  const experiences = input.resume?.experiences || [];
  const jobTitle = input.job.title;
  const matchingExperiencePositions = experiences.filter((experience) => hasMeaningfulTextMatch(experience.position, jobTitle)).map((experience) => experience.position);
  const contributions = matchingExperiencePositions.length > 0 ? [{ points: 20, reason: 'Resume experience includes a role similar to the job title.' }] : [];

  return {
    signal: 'resume',
    contributions,
    diagnostics: {
      experienceCount: experiences.length,
      experiencePositionSample: sampleValues(experiences.map((experience) => experience.position)),
      matchingExperiencePositions: sampleValues(matchingExperiencePositions),
      jobTitle: jobTitle || null,
    },
  };
}

function scoreLocationSignals(input: MatchInput): SignalEvaluation {
  const jobLocation = input.job.location;
  const professionalLocation = input.professional.location;
  const contributions: ScoreContribution[] = [];
  const jobLocationSnapshot = buildLocationSnapshot(jobLocation);
  const professionalLocationSnapshot = buildLocationSnapshot(professionalLocation);

  if (!jobLocation || !professionalLocation) {
    return {
      signal: 'location',
      contributions,
      diagnostics: {
        jobLocationPresent: Boolean(jobLocation),
        professionalLocationPresent: Boolean(professionalLocation),
        jobLocation: jobLocationSnapshot,
        professionalLocation: professionalLocationSnapshot,
        sameCity: false,
        sameState: false,
        sameCountry: false,
      },
    };
  }

  const sameCountry = Boolean(normalizeText(jobLocation.country)) && normalizeText(jobLocation.country) === normalizeText(professionalLocation.country);
  const sameState = Boolean(normalizeText(jobLocation.state)) && normalizeText(jobLocation.state) === normalizeText(professionalLocation.state);
  const sameCity = Boolean(normalizeText(jobLocation.city)) && normalizeText(jobLocation.city) === normalizeText(professionalLocation.city);

  if (sameCity && sameState && sameCountry) {
    contributions.push({ points: 10, reason: 'Professional is in the same city as the job.' });
  } else if (sameState && sameCountry) {
    contributions.push({ points: 8, reason: 'Professional is in the same state as the job.' });
  } else if (sameCountry) {
    contributions.push({ points: 6, reason: 'Professional is in the same country as the job.' });
  }

  return {
    signal: 'location',
    contributions,
    diagnostics: {
      jobLocationPresent: true,
      professionalLocationPresent: true,
      jobLocation: jobLocationSnapshot,
      professionalLocation: professionalLocationSnapshot,
      sameCity,
      sameState,
      sameCountry,
    },
  };
}

function scoreWorkPreferenceSignals(input: MatchInput): SignalEvaluation {
  const contributions: ScoreContribution[] = [];
  let matchedPreference: string | null = null;

  if (input.job.locationType === 'remote' && input.professional.openToRemote) {
    matchedPreference = 'remote';
    contributions.push({ points: 10, reason: 'Professional is open to remote work for this role.' });
  } else if (input.job.locationType === 'hybrid' && input.professional.openToRemote) {
    matchedPreference = 'hybrid';
    contributions.push({ points: 6, reason: 'Professional is open to hybrid or remote work.' });
  } else if (input.job.locationType === 'onsite' && input.professional.openToRelocation) {
    matchedPreference = 'onsite-relocation';
    contributions.push({ points: 8, reason: 'Professional is open to relocating for an onsite role.' });
  }

  return {
    signal: 'workPreference',
    contributions,
    diagnostics: {
      locationType: input.job.locationType || null,
      openToRemote: Boolean(input.professional.openToRemote),
      openToRelocation: Boolean(input.professional.openToRelocation),
      matchedPreference,
    },
  };
}

function scoreExperienceLevelSignals(input: MatchInput): SignalEvaluation {
  const jobExperienceLevel = input.job.experienceLevel || null;
  const professionalExperienceLevel = input.professional.experienceLevel || null;
  const exactMatch = Boolean(jobExperienceLevel) && jobExperienceLevel === professionalExperienceLevel;
  const contributions = exactMatch ? [{ points: 10, reason: 'Professional experience level matches the role.' }] : [];

  return {
    signal: 'experienceLevel',
    contributions,
    diagnostics: {
      jobExperienceLevel,
      professionalExperienceLevel,
      exactMatch,
    },
  };
}

function scoreIndustrySignals(input: MatchInput): SignalEvaluation {
  const jobIndustries = new Set((input.job.industries || []).map((industry) => normalizeText(industry)).filter(Boolean));
  const professionalIndustries = new Set((input.professional.industries || []).map((industry) => normalizeText(industry)).filter(Boolean));
  const overlap = getSetOverlap(jobIndustries, professionalIndustries);
  const contributions = overlap.length > 0 ? [{ points: 8, reason: 'Professional background overlaps with the role industry.' }] : [];

  return {
    signal: 'industry',
    contributions,
    diagnostics: {
      jobIndustryCount: jobIndustries.size,
      jobIndustrySample: sampleValues(jobIndustries),
      professionalIndustryCount: professionalIndustries.size,
      professionalIndustrySample: sampleValues(professionalIndustries),
      overlapCount: overlap.length,
      overlapSample: sampleValues(overlap),
    },
  };
}

function scoreKeywordSignals(input: MatchInput): SignalEvaluation {
  const requirementKeywords = buildTokenSet([...(input.job.requirements || []), ...(input.job.preferredQualifications || [])]);
  const descriptionKeywords = tokenize(input.job.description);

  const candidateKeywords = buildTokenSet([
    input.professional.headline,
    input.professional.bio,
    ...(input.resume?.experiences || []).flatMap((experience) => [experience.position, experience.orgName, ...(experience.achievements || [])]),
    ...(input.resume?.awards || []).flatMap((award) => [award.title, award.org, award.description]),
    ...(input.resume?.qa || []).flatMap((entry) => [entry.question, entry.answer]),
  ]);

  const overlap = getSetOverlap(requirementKeywords, candidateKeywords);
  const contributions: ScoreContribution[] = [];

  if (requirementKeywords.size > 0 && overlap.length > 0) {
    const points = Math.min(10, Math.max(4, overlap.length * 2));
    contributions.push({ points, reason: 'Resume content matches keywords from the job requirements.' });
  }

  return {
    signal: 'keywords',
    contributions,
    diagnostics: {
      requirementKeywordCount: requirementKeywords.size,
      requirementKeywordSample: sampleValues(requirementKeywords),
      candidateKeywordCount: candidateKeywords.size,
      candidateKeywordSample: sampleValues(candidateKeywords),
      overlapCount: overlap.length,
      overlapSample: sampleValues(overlap),
      descriptionKeywordCount: descriptionKeywords.length,
      descriptionKeywordSample: sampleValues(descriptionKeywords),
      sourceCounts: {
        requirementCount: input.job.requirements?.length || 0,
        preferredQualificationCount: input.job.preferredQualifications?.length || 0,
        experienceCount: input.resume?.experiences?.length || 0,
        awardCount: input.resume?.awards?.length || 0,
        qaCount: input.resume?.qa?.length || 0,
      },
    },
  };
}

export function scoreProfessionalForJob(input: MatchInput): MatchResult {
  const evaluations = [
    scoreRoleSignals(input),
    scoreResumeSignals(input),
    scoreLocationSignals(input),
    scoreWorkPreferenceSignals(input),
    scoreExperienceLevelSignals(input),
    scoreIndustrySignals(input),
    scoreKeywordSignals(input),
  ];
  const contributions = evaluations.flatMap((evaluation) => evaluation.contributions);

  const score = Math.max(
    0,
    Math.min(
      100,
      contributions.reduce((total, contribution) => total + contribution.points, 0)
    )
  );
  const reasons = [...new Set(contributions.map((contribution) => contribution.reason))];

  logScoreEvaluation(input, evaluations, score, reasons);

  return {
    score,
    reasons,
  };
}

export default scoreProfessionalForJob;
