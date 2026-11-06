import { Injectable, computed, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { CheckInService } from '../checkin.service';
import { StorageService } from '../../storage.service';
import { Attendee, CheckInLogEntry, PendingCheckIn, Registration, SyncResult } from '../../models';
import { inject } from '@angular/core';

const QUEUE_KEY = 'plv.checkin.queue.v1';
const CACHE_KEY = 'plv.checkin.cache.v1';
const SYNC_KEY = 'plv.checkin.lastSync.v1';

@Injectable()
export class SupabaseCheckInService extends CheckInService {
  private sb: SupabaseClient = createClient(
    environment.supabaseUrl, environment.supabaseAnonKey,
  );
  private storage = inject(StorageService);

  private _queue = signal<PendingCheckIn[]>([]);
  private _lastSync = signal<string | null>(null);
  private _cache = signal<Record<number, Attendee[]>>({});

  readonly queue = this._queue.asReadonly();
  readonly pendingCount = computed(() => this._queue().length);
  readonly lastSyncAt = this._lastSync.asReadonly();

  private unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
    if (res.error) {
      const err = new Error(res.error.message) as Error & { code?: string };
      err.code = res.error.code;
      throw err;
    }
    return res.data as T;
  }

  async ready(): Promise<void> {
    this._queue.set((await this.storage.get<PendingCheckIn[]>(QUEUE_KEY)) ?? []);
    this._lastSync.set(await this.storage.get<string>(SYNC_KEY));
    this._cache.set((await this.storage.get<Record<number, Attendee[]>>(CACHE_KEY)) ?? {});
  }

  async confirmPayment(registrationId: number): Promise<Registration> {
    return this.unwrap(await this.sb.rpc('confirm_payment', { p_registration_id: registrationId }));
  }

  async enqueue(item: PendingCheckIn): Promise<void> {
    const next = [...this._queue(), item];
    this._queue.set(next);
    await this.storage.set(QUEUE_KEY, next);
  }

  async sync(): Promise<SyncResult[]> {
    const batch = this._queue();
    if (!batch.length) return [];
    const payload = batch.map(({ client_id, registration_id, device_time, device_id, is_offline }) =>
      ({ client_id, registration_id, device_time, device_id, is_offline }));
    const results = this.unwrap(
      await this.sb.rpc('sync_check_ins', { p_batch: payload }),
    ) as SyncResult[];
    this._queue.set([]);
    await this.storage.remove(QUEUE_KEY);
    const stamp = new Date().toLocaleString();
    this._lastSync.set(stamp);
    await this.storage.set(SYNC_KEY, stamp);
    return results;
  }

  async log(eventId: number): Promise<CheckInLogEntry[]> {
    return this.unwrap(
      await this.sb.from('check_in_log').select('*').eq('event_id', eventId)
        .order('device_time', { ascending: false }),
    );
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