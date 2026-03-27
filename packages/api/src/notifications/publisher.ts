import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { NotificationEvent } from '@shelfshare/shared';

const sqs = new SQSClient({});

export async function enqueueNotification(event: NotificationEvent): Promise<void> {
  const queueUrl = process.env['NOTIFICATIONS_QUEUE_URL'];
  if (!queueUrl) {
    console.warn('NOTIFICATIONS_QUEUE_URL not set — skipping notification');
    return;
  }
  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(event),
  }));
}
