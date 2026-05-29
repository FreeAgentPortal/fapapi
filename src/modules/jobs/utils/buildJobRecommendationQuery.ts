type ProfileInput = {
  desiredRoles?: string[];
  headline?: string;
  industries?: string[];
} | null;

type ResumeInput = {
  experiences?: Array<{ position?: string }>;
} | null;

type PastJobInput = {
  title?: string;
  department?: string | null;
  industries?: string[];
};

export type RecommendationQuery = {
  orConditions: Record<string, unknown>[];
  industryTerms: string[];
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidPhrase(phrase: string | undefined | null): phrase is string {
  if (!phrase) return false;
  const trimmed = phrase.trim();
  return trimmed.length >= 3 && trimmed.length <= 60;
}

function regexPair(phrase: string): Record<string, unknown>[] {
  const pattern = escapeRegex(phrase.trim());
  return [{ title: { $regex: pattern, $options: 'i' } }, { department: { $regex: pattern, $options: 'i' } }];
}

export function buildJobRecommendationQuery(profile: ProfileInput, resume: ResumeInput, pastJobPosts: PastJobInput[]): RecommendationQuery {
  const orConditions: Record<string, unknown>[] = [];
  const industryTerms: string[] = [];

  const seenPhrases = new Set<string>();
  const seenIndustries = new Set<string>();

  function addPhrasePair(phrase: string | undefined | null): void {
    if (!isValidPhrase(phrase)) return;
    const key = phrase.trim().toLowerCase();
    if (seenPhrases.has(key)) return;
    seenPhrases.add(key);
    orConditions.push(...regexPair(phrase));
  }

  function addIndustry(industry: string | undefined | null): void {
    if (!industry?.trim()) return;
    const normalized = industry.trim().toLowerCase();
    if (seenIndustries.has(normalized)) return;
    seenIndustries.add(normalized);
    industryTerms.push(normalized);
  }

  // --- From professional profile ---
  if (profile) {
    for (const role of profile.desiredRoles ?? []) {
      addPhrasePair(role);
    }
    addPhrasePair(profile.headline);
    for (const industry of profile.industries ?? []) {
      addIndustry(industry);
    }
  }

  // --- From resume experience positions ---
  for (const exp of resume?.experiences ?? []) {
    addPhrasePair(exp.position);
  }

  // --- From past applied job posts ---
  for (const job of pastJobPosts) {
    addPhrasePair(job.title);
    addPhrasePair(job.department);
    for (const industry of job.industries ?? []) {
      addIndustry(industry);
    }
  }

  return { orConditions, industryTerms };
}
