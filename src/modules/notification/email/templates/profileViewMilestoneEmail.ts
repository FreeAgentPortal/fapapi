import type { ProfileSubjectType } from '../../../profiles/analytics/types';
import { escapeHtml } from './athleteInterestEmail';

export interface ProfileViewMilestoneMessageData {
  name: string;
  subjectType: ProfileSubjectType;
  monthLabel: string;
  viewCount: number;
}

const SIGN_IN_URL = 'https://auth.thefreeagentportal.com';

export function buildProfileViewMilestoneEmail(data: ProfileViewMilestoneMessageData): { subject: string; html: string; text: string } {
  const subject = 'Your profile is getting noticed';
  const count = data.viewCount.toLocaleString('en-US');
  const views = data.viewCount === 1 ? 'view' : 'views';
  const summary = `Your ${data.subjectType} profile received ${count} ${views} from teams, scouts, and agents in ${data.monthLabel}.`;
  const encouragement = 'Keep your profile up to date so recruiting visitors can see your latest experience and achievements.';
  const footer = 'You received this milestone update because account email notifications are enabled. You can manage your notification preferences in your account.';

  return {
    subject,
    text: [`Hi ${data.name},`, subject, summary, encouragement, `Sign in: ${SIGN_IN_URL}`, footer].join('\n\n'),
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#111827;padding:22px 30px;color:#ffffff;font-size:20px;font-weight:700;">Free Agent Portal</td></tr>
        <tr><td style="padding:32px 24px;text-align:center;">
          <p style="margin:0 0 16px;color:#5b6472;">Hi ${escapeHtml(data.name)},</p>
          <h1 style="font-size:26px;line-height:1.25;margin:0 0 24px;">${subject}</h1>
          <p style="margin:0;color:#2563eb;font-size:52px;font-weight:700;">${escapeHtml(count)}</p>
          <p style="margin:4px 0 24px;color:#5b6472;font-size:15px;">${views} &middot; ${escapeHtml(data.monthLabel)}</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(summary)}</p>
          <p style="margin:0 0 26px;color:#5b6472;font-size:15px;line-height:1.6;">${encouragement}</p>
          <a href="${SIGN_IN_URL}" style="display:inline-block;padding:14px 28px;border-radius:7px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">Sign in</a>
        </td></tr>
        <tr><td style="padding:20px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export function buildProfileViewMilestoneSMS(data: ProfileViewMilestoneMessageData): string {
  const views = data.viewCount === 1 ? 'view' : 'views';
  return `Free Agent Portal: Your ${data.subjectType} profile is getting noticed! ${data.viewCount} recruiting ${views} in ${data.monthLabel}. Sign in: ${SIGN_IN_URL}`;
}
