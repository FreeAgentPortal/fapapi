import { buildAthleteInterestEmail, escapeHtml } from '../athleteInterestEmail';

describe('athlete interest email', () => {
  it('escapes all profile and note values in HTML while retaining a text fallback', () => {
    const result = buildAthleteInterestEmail({
      athleteName: '<Alex & Co>',
      athletePhotoUrl: 'https://example.com/photo.jpg?x="bad"',
      positions: ['QB<script>'],
      college: 'A&B University',
      location: 'Austin <TX>',
      note: '<script>alert("signed")</script>',
      profileUrl: 'https://team.thefreeagentportal.com/athletes/123?a=1&b=2',
      teamName: 'Team "One"',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;alert(&quot;signed&quot;)&lt;/script&gt;');
    expect(result.html).toContain('A&amp;B University');
    expect(result.html).toContain('a=1&amp;b=2');
    expect(result.text).toContain('<script>alert("signed")</script>');
    expect(result.text).toContain('View the athlete profile:');
  });

  it('escapes apostrophes and quotes', () => {
    expect(escapeHtml(`A'B"C`)).toBe('A&#39;B&quot;C');
  });
});
