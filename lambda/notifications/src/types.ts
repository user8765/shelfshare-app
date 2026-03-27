// Inline types to avoid workspace dependency in Lambda
export type NotificationEventType =
  | 'borrow_request_created'
  | 'borrow_request_accepted'
  | 'borrow_request_declined'
  | 'borrow_request_expired'
  | 'due_date_extension_proposed'
  | 'due_date_extension_confirmed'
  | 'new_message';

export interface NotificationEvent {
  type: NotificationEventType;
  borrowRequestId?: string;
  bookTitle?: string;
  ownerEmail?: string;
  ownerName?: string;
  borrowerEmail?: string;
  borrowerName?: string;
  dueDate?: string;
  messagePreview?: string;
  recipientEmail: string;
  recipientName: string;
}
