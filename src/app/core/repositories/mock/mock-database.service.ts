import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../../storage.service';
import {
  AppUser, AuditLogEntry, Attendee, CheckInLogEntry, EventItem,
  PendingCheckIn, Registration,
} from '../../models';

const KEY = 'plv.mock.v1';

interface MockState {
  currentUserId: string | null;
  passwords: Record<string, string>;   // NEW — user_id -> password
  users: AppUser[];
  events: EventItem[];
  registrations: Registration[];
  attendeeCache: Record<number, Attendee[]>;
  checkInQueue: PendingCheckIn[];
  checkInLog: CheckInLogEntry[];
  auditLog: AuditLogEntry[];
  nextRegistrationId: number;
  nextEventId: number;
}

function seed(): MockState {
  const now = new Date().toISOString();
  const users: AppUser[] = [
    { id: 'u-maria', first_name: 'Maria', last_name: 'Santos',
      email: 'test@plv', username: 'maria.santos',
      phone: '09171234567', department: 'CEIT', program: 'BSIT',
      batch: '2016', role: 'alumni', created_at: now },
    { id: 'u-admin', first_name: 'Admin', last_name: 'PLV',
      email: 'admin@plv', username: 'admin',
      phone: '09170000001', department: 'CEIT', program: 'BSIT',
      batch: '2010', role: 'admin', created_at: now },
    { id: 'u-volunteer', first_name: 'Volunteer', last_name: 'PLV',
      email: 'volunteer@plv', username: 'volunteer',
      phone: '09170000002', department: 'CEIT', program: 'BSIT',
      batch: '2020', role: 'volunteer', created_at: now },
  ];

  const events: EventItem[] = [
    { id: 1, name: 'Grand Alumni Homecoming', venue: 'PLV Gymnasium',
      description: 'A night for alumni to reconnect, meet friends from different batches, and celebrate the PLV journey.',
      event_date: '2026-12-12T16:00:00Z', price: 1500, capacity: 200,
      banner_url: null, status: 'listed', created_by: 'u-admin', closed_at: null },
    { id: 2, name: 'Batch 2016 Reunion', venue: 'Function Hall',
      description: 'Ten years on. Catch up with your batchmates over dinner and a short program.',
      event_date: '2026-11-28T14:00:00Z', price: 800, capacity: 94,
      banner_url: null, status: 'listed', created_by: 'u-admin', closed_at: null },
    { id: 3, name: 'Alumni Career Connect', venue: 'PLV Main Campus',
      description: 'Meet alumni mentors, hear industry talks, and expand your professional network.',
      event_date: '2027-01-17T09:00:00Z', price: 0, capacity: 150,
      banner_url: null, status: 'listed', created_by: 'u-admin', closed_at: null },
  ];

  const registrations: Registration[] = [
    { id: 1, event_id: 1, user_id: 'u-maria', attendee_status: 'not_checked_in',
      payment_status: 'unpaid', checked_in_at: null, payment_collected_by: null,
      payment_collected_at: null, created_at: now,
      qr_token: '11111111-1111-4111-8111-111111111111' },
    { id: 2, event_id: 2, user_id: 'u-maria', attendee_status: 'not_checked_in',
      payment_status: 'unpaid', checked_in_at: null, payment_collected_by: null,
      payment_collected_at: null, created_at: now,
      qr_token: '22222222-2222-4222-8222-222222222222' },
  ];

 return {
    currentUserId: null,
    passwords: {
      'u-maria': 'demo1234',
      'u-admin': 'demo1234',
      'u-volunteer': 'demo1234',
    },
    users, events, registrations,
    attendeeCache: {}, checkInQueue: [], checkInLog: [], auditLog: [],
    nextRegistrationId: 3, nextEventId: 4,
  };
}

/** In-memory + persisted mock state, shared by all Mock* services. */
@Injectable({ providedIn: 'root' })
export class MockDatabase {
  private storage = inject(StorageService);

  readonly state = signal<MockState>(seed());
  readonly currentUser = computed(() => {
    const uid = this.state().currentUserId;
    return uid ? this.state().users.find((u) => u.id === uid) ?? null : null;
  });
  readonly currentRole = computed(() => this.currentUser()?.role ?? null);

  private loaded = false;
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const saved = await this.storage.get<MockState>(KEY);
    if (saved) this.state.set(saved);
    this.loaded = true;
  }

  patch<K extends keyof MockState>(patch: Partial<MockState>): void {
    this.state.update((s) => ({ ...s, ...patch }));
    void this.storage.set(KEY, this.state());
  }

  update(fn: (s: MockState) => MockState): void {
    this.state.update(fn);
    void this.storage.set(KEY, this.state());
  }

  async reset(): Promise<void> {
    this.state.set(seed());
    await this.storage.set(KEY, this.state());
  }
}