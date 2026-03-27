// Shared types, enums and constants for ShelfShare
// All packages import from here — single source of truth

export type BookStatus = 'available' | 'pending' | 'lent_out' | 'unavailable';
export type BookVisibility = 'radius' | 'community' | 'both' | 'private';
export type BorrowRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'returned';
export type CommunityRole = 'admin' | 'member';
export type BorrowRequestAction = 'accept' | 'decline' | 'return' | 'propose-extension' | 'confirm-extension';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locationText: string | null;
  emailNotif: boolean;
  createdAt: string;
}

export interface Book {
  id: string;
  ownerId: string;
  isbn: string | null;
  title: string;
  author: string | null;
  genre: string | null;
  coverUrl: string | null;
  description: string | null;
  status: BookStatus;
  isLendable: boolean;
  visibility: BookVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface BorrowRequest {
  id: string;
  bookId: string;
  requesterId: string;
  status: BorrowRequestStatus;
  dueDate: string | null;
  proposedDueDate: string | null;
  extensionProposedBy: string | null;
  requestExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export const DEFAULT_RADIUS_METERS = 5000;
export const DEFAULT_BORROW_EXPIRY_HOURS = 48;

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
