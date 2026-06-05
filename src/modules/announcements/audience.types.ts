export type AudienceSegment =
  | 'ALL_PARTNERS'
  | 'ALL_EMPLOYERS'
  | 'MY_EMPLOYERS'
  | 'MY_CLIENTS'
  | 'MY_WORKERS';

export const ALL_SEGMENTS: AudienceSegment[] = [
  'ALL_PARTNERS',
  'ALL_EMPLOYERS',
  'MY_EMPLOYERS',
  'MY_CLIENTS',
  'MY_WORKERS',
];

export type RecipientRole = 'PARTNER' | 'EMPLOYER' | 'CLIENT' | 'WORKER';

export type SenderRole = 'ADMIN' | 'PARTNER' | 'EMPLOYER';

export const SEGMENTS_BY_SENDER_ROLE: Record<SenderRole, AudienceSegment[]> = {
  ADMIN: ['ALL_PARTNERS', 'ALL_EMPLOYERS'],
  PARTNER: ['MY_EMPLOYERS'],
  EMPLOYER: ['MY_CLIENTS', 'MY_WORKERS'],
};

export interface Recipient {
  userId: number;
  role: RecipientRole;
}

export interface AudienceSender {
  userId: number;
  roleName: SenderRole;
}
