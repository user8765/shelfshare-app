import type { NotificationEvent, NotificationEventType } from './types.js';

interface EmailContent { subject: string; body: string }

export function renderEmail(event: NotificationEvent): EmailContent {
  const templates: Record<NotificationEventType, () => EmailContent> = {
    borrow_request_created: () => ({
      subject: `📚 Borrow request for "${event.bookTitle}"`,
      body: `Hi ${event.recipientName},\n\n${event.borrowerName} has requested to borrow "${event.bookTitle}".\n\nLog in to ShelfShare to accept or decline.\n\nCheers,\nShelfShare`,
    }),
    borrow_request_accepted: () => ({
      subject: `✅ Your request for "${event.bookTitle}" was accepted`,
      body: `Hi ${event.recipientName},\n\n${event.ownerName} has accepted your request to borrow "${event.bookTitle}".\n\nDue date: ${event.dueDate ?? 'TBD'}\n\nCoordinate pickup via ShelfShare messages.\n\nCheers,\nShelfShare`,
    }),
    borrow_request_declined: () => ({
      subject: `❌ Your request for "${event.bookTitle}" was declined`,
      body: `Hi ${event.recipientName},\n\n${event.ownerName} has declined your request to borrow "${event.bookTitle}".\n\nCheers,\nShelfShare`,
    }),
    borrow_request_expired: () => ({
      subject: `⏰ Borrow request for "${event.bookTitle}" expired`,
      body: `Hi ${event.recipientName},\n\nThe borrow request for "${event.bookTitle}" has expired without a response.\n\nCheers,\nShelfShare`,
    }),
    due_date_extension_proposed: () => ({
      subject: `📅 Due date extension proposed for "${event.bookTitle}"`,
      body: `Hi ${event.recipientName},\n\nA due date extension has been proposed for "${event.bookTitle}".\n\nProposed new due date: ${event.dueDate ?? 'TBD'}\n\nLog in to confirm or discuss.\n\nCheers,\nShelfShare`,
    }),
    due_date_extension_confirmed: () => ({
      subject: `📅 Due date extension confirmed for "${event.bookTitle}"`,
      body: `Hi ${event.recipientName},\n\nThe due date for "${event.bookTitle}" has been extended to ${event.dueDate ?? 'TBD'}.\n\nCheers,\nShelfShare`,
    }),
    new_message: () => ({
      subject: `💬 New message on ShelfShare`,
      body: `Hi ${event.recipientName},\n\nYou have a new message:\n\n"${event.messagePreview ?? ''}"\n\nLog in to reply.\n\nCheers,\nShelfShare`,
    }),
  };

  return templates[event.type]();
}
