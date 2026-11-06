// TypeScript models mirroring schema_v3.sql.

export type UserRole = 'alumni' | 'admin' | 'volunteer';
export type EventStatus = 'listed' | 'closed';
export type AttendeeStatus = 'not_checked_in' | 'checked_in' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'free';
export type ScanResult = 'accepted' | 'duplicate' | 'rejected';
export type Department = 'CEIT' | 'CABA' | 'COE' | 'CAS';
export type Program = 'BSEE' | 'BSIT' | 'BSCE';

export interface AppUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone: string;
  department: Department;
  program: Program;
  batch: string;
  role: UserRole;
  created_at: string;
}

export const USER_COLUMNS =
  'id, first_name, last_name, email, username, phone, department, program, batch, role, created_at';

export interface SignInInput { email: string; password: string; }

export interface SignUpInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  department: Department;
  program: Program;
  batch: string;
}

export type ProfileUpdate = Partial<
  Pick<AppUser, 'username' | 'first_name' | 'last_name' | 'phone' | 'department' | 'program' | 'batch'>
>;

// ---------- Events ----------
export interface EventItem {
  id: number;
  name: string;
  venue: string;
  description: string;
  event_date: string;
  price: number | null;
  capacity: number | null;
  banner_url: string | null;
  status: EventStatus;
  created_by: string | null;
  closed_at: string | null;
}

export interface EventWithAvailability extends EventItem {
  registered: number;
  available: number | null;
}

export interface EventAvailability {
  event_id: number;
  capacity: number | null;
  registered: number;
  available: number | null;
}

export type NewEvent = Pick<
  EventItem,
  'name' | 'venue' | 'description' | 'event_date' | 'price' | 'capacity' | 'banner_url'
>;

export type EventUpdate = Partial<NewEvent>;

// ---------- Registrations ----------
export interface Registration {
  id: number;
  event_id: number;
  user_id: string;
  attendee_status: AttendeeStatus;
  payment_status: PaymentStatus;
  checked_in_at: string | null;
  payment_collected_by: string | null;
  payment_collected_at: string | null;
  created_at: string;
  qr_token: string;
}

export interface MyTicket extends Registration {
  event: Pick<EventItem, 'id' | 'name' | 'venue' | 'event_date' | 'price' | 'status' | 'banner_url'>;
}

export interface Attendee {
  registration_id: number;
  qr_token: string;
  first_name: string;
  last_name: string;
  attendee_status: AttendeeStatus;
  payment_status: PaymentStatus;
  checked_in_at: string | null;
}

// ---------- Check-in ----------
export interface PendingCheckIn {
  client_id: string;
  registration_id: number;
  device_time: string;
  device_id?: string;
  is_offline: boolean;
}

export interface SyncResult { client_id: string; result: ScanResult; }

export interface CheckInLogEntry {
  id: number;
  client_id: string;
  registration_id: number;
  event_id: number;
  scanned_by: string;
  device_id: string | null;
  result: ScanResult;
  is_offline: boolean;
  device_time: string;
  synced_at: string;
}

// ---------- Admin ----------
export interface EventDashboardStats {
  event_id: number;
  name: string;
  capacity: number | null;
  registered: number;
  checked_in: number;
  cancelled: number;
  paid: number;
  unpaid: number;
  revenue: number;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: number;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ---------- Errors ----------
export const DB_ERROR = {
  ALREADY_REGISTERED: '23505',
  NOT_FOUND: 'P0002',
  RULE_VIOLATION: 'P0001',
  FORBIDDEN: '42501',
  NOT_AUTHENTICATED: '28000',
} as const;