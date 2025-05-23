import sgMail from '@sendgrid/mail';

/**
 * @description - This function sends an email to a single user, can be used for registration, password reset, etc.
 * @param {Object} options - The options for sending the email.
 * @param {String} options.to - The recipient's email address.
 * @param {String} options.from - The sender's email address.
 * @param {String} options.subject - The subject of the email.
 * @param {String} options.templateId - The ID of the SendGrid dynamic template.
 * @param {Object} options.dynamicTemplateData - The dynamic data to populate the template.
 * @returns {Promise} - A promise that resolves to a SendGrid response.
 *
 * @author Austin Howard
 * @since 1.0.0
 * @version 1.2.0
 * @lastUpdated 2024-02-14 13:22:37
 * @lastUpdatedBy Austin Howard
 *
 */
export default async (options: {
  personalizations?: { to: { email: string; name: string }[] }[];
  to?: string;
  from: string;
  templateId: string;
  dynamicTemplateData: any;
}) => {
  sgMail.setApiKey(process.env.SEND_GRID_API_KEY!);

  await sgMail.send({
    personalizations: options.personalizations,
    to: options.to,
    from: options.from,
    templateId: options.templateId,
    dynamicTemplateData: options.dynamicTemplateData,
  });
};
