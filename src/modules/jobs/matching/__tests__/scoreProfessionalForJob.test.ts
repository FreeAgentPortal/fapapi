import { describe, expect, it } from '@jest/globals';
import scoreProfessionalForJob from '../scoreProfessionalForJob';
import { MatchInput } from '../types';

function buildInput(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    job: {
      title: 'Senior Football Operations Manager',
      department: 'Football Operations',
      locationType: 'remote',
      location: {
        city: 'Dallas',
        state: 'Texas',
        country: 'USA',
      },
      description: 'Lead football operations and player logistics.',
      requirements: ['football operations leadership', 'salary cap analysis', 'player logistics'],
      preferredQualifications: ['nfl experience', 'contract negotiation'],
      experienceLevel: 'senior',
      industries: ['Football', 'Sports'],
    },
    professional: {
      _id: 'professional-1' as any,
      displayName: 'Alex Front Office',
      headline: 'Senior football operations leader with salary cap experience',
      bio: 'Built player logistics and contract workflows for pro football teams.',
      location: {
        city: 'Dallas',
        state: 'Texas',
        country: 'USA',
      },
      desiredRoles: ['Football Operations Manager', 'Director of Football Administration'],
      industries: ['Football', 'Sports'],
      experienceLevel: 'senior',
      openToRelocation: false,
      openToRemote: true,
      jobSearchStatus: 'open',
      visibility: 'public',
    },
    resume: {
      experiences: [
        {
          orgName: 'Example Football Club',
          position: 'Football Operations Manager',
          location: {
            city: 'Dallas',
            state: 'Texas',
            country: 'USA',
          },
          achievements: ['Led player logistics', 'Managed salary cap planning'],
        },
      ],
      awards: [
        {
          title: 'Operations Excellence Award',
          org: 'League Office',
          description: 'Recognized for football administration and player logistics',
        },
      ],
      qa: [
        {
          promptId: 'leadership-style',
          question: 'Describe your leadership style',
          answer: 'I lead football operations teams through clear contract and logistics planning.',
        },
      ],
    },
    ...overrides,
  };
}

describe('scoreProfessionalForJob', () => {
  it('returns a strong score for aligned role, resume, location, and keyword signals', () => {
    const result = scoreProfessionalForJob(buildInput());

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'Desired role aligns with the job title.',
        'Resume experience includes a role similar to the job title.',
        'Professional is open to remote work for this role.',
      ])
    );
  });

  it('awards a partial score when the department matches but the title does not', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        job: {
          ...buildInput().job,
          title: 'Senior Club Executive',
        },
        professional: {
          ...buildInput().professional,
          desiredRoles: ['Football Operations Specialist'],
        },
        resume: {
          ...buildInput().resume!,
          experiences: [
            {
              orgName: 'Example Club',
              position: 'Player Personnel Coordinator',
              achievements: ['Supported football operations leadership'],
            },
          ],
        },
      })
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain('Desired role aligns with the job department.');
    expect(result.reasons).not.toContain('Desired role aligns with the job title.');
  });

  it('gives credit when resume experience matches the title even if desired roles are sparse', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        professional: {
          ...buildInput().professional,
          desiredRoles: [],
        },
      })
    );

    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.reasons).toContain('Resume experience includes a role similar to the job title.');
  });

  it('rewards relocation for onsite roles when direct location alignment is missing', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        job: {
          ...buildInput().job,
          locationType: 'onsite',
          location: {
            city: 'Nashville',
            state: 'Tennessee',
            country: 'USA',
          },
        },
        professional: {
          ...buildInput().professional,
          openToRemote: false,
          openToRelocation: true,
          location: {
            city: 'Seattle',
            state: 'Washington',
            country: 'USA',
          },
        },
      })
    );

    expect(result.reasons).toContain('Professional is open to relocating for an onsite role.');
  });

  it('does not award experience-level points when the levels do not match', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        professional: {
          ...buildInput().professional,
          experienceLevel: 'mid',
        },
      })
    );

    expect(result.reasons).not.toContain('Professional experience level matches the role.');
  });

  it('does not award industry overlap points when industries do not match', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        professional: {
          ...buildInput().professional,
          industries: ['Finance'],
        },
      })
    );

    expect(result.reasons).not.toContain('Professional background overlaps with the role industry.');
  });

  it('matches requirement keywords from resume and profile content', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        resume: {
          experiences: [
            {
              orgName: 'Pro Team',
              position: 'Operations Analyst',
              achievements: ['Owned salary cap analysis and player logistics'],
            },
          ],
          awards: [],
          qa: [],
        },
      })
    );

    expect(result.reasons).toContain('Resume content matches keywords from the job requirements.');
  });

  it('handles a missing resume without throwing and still returns a deterministic score', () => {
    const result = scoreProfessionalForJob(
      buildInput({
        resume: null,
      })
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).not.toContain('Resume experience includes a role similar to the job title.');
  });
});
