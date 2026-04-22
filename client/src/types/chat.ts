export type AttachmentType = 'image' | 'file';

export interface ChatAttachment {
  url: string;
  type: AttachmentType;
  name?: string;
  mimeType?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
}
