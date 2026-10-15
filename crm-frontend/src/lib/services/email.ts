'use server';

/**
 * Email Service
 *
 * All email functions now accept workspace settings to personalize content.
 * If settings are not provided, minimal defaults are used.
 */

interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

interface EmailSettings {
  companyName?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  footerText?: string;
  supportContact?: string;
}

function getName(s?: EmailSettings) {
  return s?.companyName || 'Your Company';
}

function getFooter(s?: EmailSettings) {
  if (s?.footerText) return s.footerText;
  return `Best regards,<br>The ${getName(s)} Team`;
}

function getLogoHtml(s?: EmailSettings) {
  if (s?.logoUrl) {
    return `<img src="${s.logoUrl}" alt="${getName(s)}" style="height: 40px; margin-bottom: 16px;" />`;
  }
  return '';
}

function getContactHtml(s?: EmailSettings) {
  const parts: string[] = [];
  if (s?.phone) parts.push(s.phone);
  if (s?.email) parts.push(s.email);
  if (s?.website) parts.push(s.website);
  if (parts.length === 0) return '';
  return `<p style="font-size: 12px; color: #999; margin-top: 16px;">${parts.join(' | ')}</p>`;
}

export async function sendEmail({ to, subject, html, attachments }: SendEmailParams) {
  try {
    const response = await fetch(process.env.EMAIL_API_URL || '', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.EMAIL_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        attachments,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API error: ${response.statusText}`);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error as Error };
  }
}

export async function sendWelcomeEmail(to: string, fullName: string, settings?: EmailSettings) {
  const name = getName(settings);
  return sendEmail({
    to,
    subject: `Welcome to ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000;">Welcome to ${name}!</h1>
        <p>Hi ${fullName},</p>
        <p>Thank you for registering with ${name}. We're excited to have you on board!</p>
        <p>You can now log in and start creating projects, tracking progress, and managing your work with us.</p>
        <p>If you have any questions, feel free to reach out through our support system.</p>
        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}

export async function sendProjectUpdateEmail(
  to: string,
  projectTitle: string,
  message: string,
  updatedBy: string,
  settings?: EmailSettings
) {
  const name = getName(settings);
  return sendEmail({
    to,
    subject: `Project Updated: ${projectTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000; font-size: 24px;">Project Update Alert</h1>
        <p>A change was made to your project <strong>${projectTitle}</strong> by <strong>${updatedBy}</strong>.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        <p>Please log in to your dashboard to view the current project status and details.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
        </div>
        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}

export async function sendSupportTicketEmail(
  to: string,
  subject: string,
  description: string,
  clientName: string,
  isAdmin: boolean,
  settings?: EmailSettings
) {
  const name = getName(settings);
  const header = isAdmin ? 'New Support Ticket Received' : 'Support Ticket Update';
  const subtext = isAdmin
    ? `A new support ticket has been submitted by <strong>${clientName}</strong>.`
    : `There is an update on your support ticket: <strong>${subject}</strong>.`;

  return sendEmail({
    to,
    subject: `Support Alert: ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000; font-size: 24px;">${header}</h1>
        <p>${subtext}</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Subject:</strong> ${subject}</p>
          <p style="margin: 10px 0 0 0; white-space: pre-wrap;"><strong>Description/Update:</strong><br>${description}</p>
        </div>
        <p>Log in to the portal to manage this ticket.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Portal</a>
        </div>
        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  title: string,
  message: string,
  link?: string,
  linkText: string = 'View Details',
  settings?: EmailSettings
) {
  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000; font-size: 24px;">${title}</h1>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        ${link ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}${link}" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">${linkText}</a>
        </div>
        ` : ''}
        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}

export async function sendInvitationEmail(
  to: string,
  role: string,
  invitedBy: string,
  settings?: EmailSettings
) {
  const name = getName(settings);
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/register?email=${encodeURIComponent(to)}&role=${role}`;

  return sendEmail({
    to,
    subject: `Invitation to join ${name} as ${role}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000; font-size: 24px;">Join the Team</h1>
        <p>You have been invited by <strong>${invitedBy}</strong> to join ${name} as a <strong>${role}</strong>.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;">Click the button below to complete your registration and join the workspace.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation</a>
        </div>
        <p style="font-size: 12px; color: #666;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}

export async function sendInvoiceEmail(
  to: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string,
  settings?: EmailSettings
) {
  const name = getName(settings);
  return sendEmail({
    to,
    subject: `New Invoice: ${invoiceNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000;">New Invoice</h1>
        <p>You have received a new invoice from ${name}.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Amount:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">$${amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Due Date:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${dueDate}</td>
          </tr>
        </table>
        <p>Please log in to your dashboard to view the full invoice and payment details.</p>
        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}

export async function sendMeetingStatusEmail(
  to: string,
  purpose: string,
  requestedDate: string,
  duration: number,
  status: string,
  meetingLink?: string,
  settings?: EmailSettings
) {
  const name = getName(settings);
  const isAccepted = status === 'accepted';
  const subject = isAccepted ? `Meeting Scheduled: ${purpose}` : `Meeting Update: ${purpose}`;

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        ${getLogoHtml(settings)}
        <h1 style="color: #000; font-size: 24px;">Meeting ${isAccepted ? 'Scheduled' : 'Updated'}</h1>
        <p>Your meeting request has been ${status}.</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Purpose:</strong> ${purpose}</p>
          <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${new Date(requestedDate).toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>Duration:</strong> ${duration} minutes</p>
          ${meetingLink ? `<p style="margin: 15px 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #0066cc; text-decoration: underline;">Join Meeting</a></p>` : ''}
        </div>

        ${meetingLink ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${meetingLink}" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Meeting</a>
        </div>` : '<p>If this was scheduled via Google Meet or Zoom, you will receive a calendar invite shortly.</p>'}

        <p>${getFooter(settings)}</p>
        ${getContactHtml(settings)}
      </div>
    `,
  });
}
