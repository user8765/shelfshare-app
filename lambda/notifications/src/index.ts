import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { SQSHandler } from 'aws-lambda';
import { renderEmail } from './templates.js';
import type { NotificationEvent } from './types.js';

const ses = new SESClient({});
const FROM = process.env['SES_FROM_EMAIL'] ?? 'noreply@shelfshare.app';

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const notification = JSON.parse(record.body) as NotificationEvent;
    const { subject, body } = renderEmail(notification);

    await ses.send(new SendEmailCommand({
      Source: FROM,
      Destination: { ToAddresses: [notification.recipientEmail] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    }));
  }
};
