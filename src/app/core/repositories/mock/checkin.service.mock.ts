import { Injectable, computed, inject, signal } from '@angular/core';
import { MockDatabase } from './mock-database.service';
import { CheckInService } from '../checkin.service';
import { StorageService } from '../../storage.service';
import {
  Attendee, CheckInLogEntry, PendingCheckIn, Registration, SyncResult,
} from '../../models';

const QUEUE_KEY = 'plv.mock.queue.v1';
const CACHE_KEY = 'plv.mock.cache.v1';
const SYNC_KEY = 'plv.mock.lastSync.v1';

@Injectable()
export class MockCheckInService extends CheckInService {
  private db = inject(MockDatabase);
  private storage = inject(StorageService);

  private _queue = signal<PendingCheckIn[]>([]);
  private _lastSync = signal<string | null>(null);
  private _cache = signal<Record<number, Attendee[]>>({});

  readonly queue = this._queue.asReadonly();
  readonly pendingCount = computed(() => this._queue().length);
  readonly lastSyncAt = this._lastSync.asReadonly();

  async ready(): Promise<void> {
    await this.db.ensureLoaded();
    this._queue.set((await this.storage.get<PendingCheckIn[]>(QUEUE_KEY)) ?? []);
    this._lastSync.set(await this.storage.get<string>(SYNC_KEY));
    this._cache.set((await this.storage.get<Record<number, Attendee[]>>(CACHE_KEY)) ?? {});
  }

  async confirmPayment(registrationId: number): Promise<Registration> {
    await this.db.ensureLoaded();
    const user = this.db.currentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'volunteer')) {
      throw new Error('Not allowed.');
    }
    const reg = this.db.state().registrations.find((r) => r.id === registrationId);
    if (!reg) throw new Error('Registration not found.');
    if (reg.attendee_status === 'cancelled') throw new Error('Registration is cancelled.');
    if (reg.payment_status !== 'unpaid') throw new Error('Nothing to collect.');
    const updated: Registration = {
      ...reg, payment_status: 'paid',
      payment_collected_by: user.id, payment_collected_at: new Date().toISOString(),
    };
    this.db.update((s) => ({
      ...s, registrations: s.registrations.map((r) => r.id === registrationId ? updated : r),
    }));
    return updated;
  }

  async enqueue(item: PendingCheckIn): Promise<void> {
    const next = [...this._queue(), item];
    this._queue.set(next);
    await this.storage.set(QUEUE_KEY, next);
  }

  async sync(): Promise<SyncResult[]> {
    await this.db.ensureLoaded();
    const batch = this._queue();
    if (!batch.length) return [];
    const results: SyncResult[] = [];
    const s = this.db.state();
    const today = new Date().toISOString();

    this.db.update((st) => {
      let regs = [...st.registrations];
      let logs = [...st.checkInLog];
      const sorted = [...batch].sort((a, b) => a.device_time.localeCompare(b.device_time));
      for (const item of sorted) {
        const reg = regs.find((r) => r.id === item.registration_id);
        let result: 'accepted' | 'duplicate' | 'rejected' = 'rejected';
        if (reg) {
          if (reg.attendee_status === 'cancelled') result = 'rejected';
          else if (reg.attendee_status === 'not_checked_in') {
            result = 'accepted';
            regs = regs.map((r) => r.id === reg.id
              ? { ...r, attendee_status: 'checked_in', checked_in_at: item.device_time }
              : r);
          } else if (reg.checked_in_at && item.device_time < reg.checked_in_at) {
            result = 'accepted';
            regs = regs.map((r) => r.id === reg.id
              ? { ...r, checked_in_at: item.device_time } : r);
          } else {
            result = 'duplicate';
          }
        }
        logs.push({
          id: logs.length + 1, client_id: item.client_id,
          registration_id: item.registration_id, event_id: reg?.event_id ?? 0,
          scanned_by: st.currentUserId ?? '', device_id: item.device_id ?? null,
          result, is_offline: item.is_offline, device_time: item.device_time,
          synced_at: today,
        });
        results.push({ client_id: item.client_id, result });
      }
      return { ...st, registrations: regs, checkInLog: logs };
    });

    this._queue.set([]);
    await this.storage.remove(QUEUE_KEY);
    const stamp = new Date().toLocaleString();
    this._lastSync.set(stamp);
    await this.storage.set(SYNC_KEY, stamp);
    return results;
  }

  async log(eventId: number): Promise<CheckInLogEntry[]> {
    await this.db.ensureLoaded();
    return this.db.state().checkInLog
      .filter((l) => l.event_id === eventId)
      .sort((a, b) => b.device_time.localeCompare(a.device_time));
  }

  async cacheAttendeeList(eventId: number, rows: Attendee[]): Promise<void> {
    const next = { ...this._cache(), [eventId]: rows };
    this._cache.set(next);
    await this.storage.set(CACHE_KEY, next);
  }

  async getCachedAttendeeList(eventId: number): Promise<Attendee[] | null> {
    return this._cache()[eventId] ?? null;
  }

  async clearCachedLists(): Promise<void> {
    this._cache.set({});
    await this.storage.remove(CACHE_KEY);
  }
}