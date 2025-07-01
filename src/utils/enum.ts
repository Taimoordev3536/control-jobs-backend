export enum UserRole {
  ADMIN = 'admin',
  CLIENT = 'client',
  HELPER = 'helper',
}

export enum Status {
  ACTIVE = 'active',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  INACTIVE = 'inactive',
}

export enum OrderStatus {
  NEW = 'new',
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export enum BookingType {
  SINGLE = 'single',
  RECURRING = 'recurring',
}
