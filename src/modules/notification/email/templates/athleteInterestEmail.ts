export interface AthleteInterestEmailData {
  athleteName: string;
  athletePhotoUrl?: string;
  positions?: string[];
  college?: string;
  location?: string;
  note?: string;
  profileUrl: string;
  teamName: string;
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });

export function buildAthleteInterestEmail(data: AthleteInterestEmailData): { html: string; text: string } {
  const athleteName = escapeHtml(data.athleteName);
  const teamName = escapeHtml(data.teamName);
  const profileUrl = escapeHtml(data.profileUrl);
  const details = [data.positions?.filter(Boolean).join(' / '), data.college, data.location].filter(Boolean) as string[];
  const escapedDetails = details.map(escapeHtml);
  const note = data.note ? escapeHtml(data.note) : undefined;
  const photo = data.athletePhotoUrl
    ? `<img src="${escapeHtml(data.athletePhotoUrl)}" alt="${athleteName}" width="88" height="88" style="display:block;width:88px;height:88px;border-radius:44px;object-fit:cover;margin:0 auto 18px;" />`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#111827;padding:22px 30px;color:#ffffff;font-size:20px;font-weight:700;">Free Agent Portal</td></tr>
          <tr><td style="padding:32px 30px;text-align:center;">
            ${photo}
            <h1 style="font-size:25px;line-height:1.25;margin:0 0 10px;">${athleteName} expressed interest in ${teamName}</h1>
            ${escapedDetails.length ? `<p style="margin:0 0 22px;color:#5b6472;font-size:15px;">${escapedDetails.join(' &middot; ')}</p>` : ''}
            ${note ? `<div style="margin:0 0 24px;padding:18px;text-align:left;background:#f7f8fa;border-left:4px solid #2563eb;border-radius:6px;white-space:pre-wrap;font-size:15px;line-height:1.5;">${note}</div>` : ''}
            <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.55;">Review the athlete's profile, then open or start a conversation from your team inbox.</p>
            <a href="${profileUrl}" style="display:inline-block;padding:13px 22px;border-radius:7px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">View athlete profile</a>
          </td></tr>
          <tr><td style="padding:20px 30px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;">You received this because you are linked to ${teamName} and team alerts are enabled.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const textParts = [
    `${data.athleteName} expressed interest in ${data.teamName}.`,
    details.length ? details.join(' · ') : undefined,
    data.note ? `Note: ${data.note}` : undefined,
    `View the athlete profile: ${data.profileUrl}`,
  ].filter(Boolean);

  return { html, text: textParts.join('\n\n') };
}
