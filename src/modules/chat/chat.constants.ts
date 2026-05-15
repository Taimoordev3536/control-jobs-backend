export const ADMIN_ENTITY_ID = 0;
export const ADMIN_PUBLIC_ID = '00000000-0000-0000-0000-000000000000';
export const MESSAGE_PAGE_SIZE = 50;
export const SEARCH_PAGE_SIZE = 50;

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);
export const ALLOWED_PDF_MIME = new Set(['application/pdf']);
