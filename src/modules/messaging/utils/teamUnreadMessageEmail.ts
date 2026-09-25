interface TeamUnreadMessageEmailData {
  teamName: string;
  senderName: string;
  messagePreview: string;
  conversationId: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character];
  });

export function buildTeamUnreadMessageEmail(data: TeamUnreadMessageEmailData): { html: string; text: string; subject: string } {
  const teamName = escapeHtml(data.teamName);
  const senderName = escapeHtml(data.senderName);
  const messagePreview = escapeHtml(data.messagePreview);
  const messageUrl = `https://team.thefreeagentportal.com/opportunities_hub/messages/${encodeURIComponent(data.conversationId)}`;
  const subject = `Unread message from ${data.senderName.replace(/[\r\n]+/g, ' ')} on Free Agent Portal`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unread message on Free Agent Portal</title>
  </head>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
    <div style="display:none;max-height:0;overflow:hidden;">${senderName} sent ${teamName} a message. Open your inbox to read and reply.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;">
      <tr><td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#111827;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;">Free Agent Portal</td></tr>
          <tr><td style="padding:30px 28px;">
            <h1 style="font-size:25px;line-height:1.3;margin:0 0 18px;">You have an unread message</h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hi ${teamName},</p>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.6;"><strong>${senderName}</strong> sent your team a message on Free Agent Portal. Open your inbox to read it and continue the conversation.</p>
            <div style="margin:0 0 24px;padding:18px;background:#f7f8fa;border-left:4px solid #2563eb;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.6;">${messagePreview}</div>
            <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#2563eb" style="border-radius:7px;">
              <a href="${messageUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;">Read and reply</a>
            </td></tr></table>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5b6472;">If the button doesn't work, open this link:<br /><a href="${messageUrl}" style="color:#2563eb;word-break:break-all;">${messageUrl}</a></p>
          </td></tr>
          <tr><td style="padding:20px 28px;background:#f9fafb;color:#5b6472;font-size:12px;line-height:1.6;">You received this reminder because you have access to ${teamName} on Free Agent Portal. You can manage email notifications in your account settings.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${data.teamName},`,
    `${data.senderName} sent your team a message on Free Agent Portal. Open your inbox to read it and continue the conversation.`,
    data.messagePreview,
    `Read and reply: ${messageUrl}`,
    'You can manage email notifications in your account settings.',
  ].join('\n\n');

  return { html, text, subject };
}
