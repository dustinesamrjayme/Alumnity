import { Injectable, computed, inject, signal } from '@angular/core';
import { Device } from '@capacitor/device';
import { LocalDb } from './local-db.service';
import { Attendee, PendingCheckIn, SyncResult } from './models';

/** Queued rows older than this that the server already confirmed get purged. */
const KEEP_SYNCED_DAYS = 7;

/**
 * The offline half of check-in: attendee cache + outbox, both in SQLite.
 * Knows nothing about Supabase; the repository services own the network call.
 */
@Injectable({ providedIn: 'root' })
export class CheckInStore {
  private db = inject(LocalDb);

  private _queue = signal<PendingCheckIn[]>([]);
  private _lastSync = signal<string | null>(null);

  /** Unsynced check-ins, oldest first. Drives the "N pending" badges. */
  readonly queue = this._queue.asReadonly();
  readonly pendingCount = computed(() => this._queue().length);
  readonly lastSyncAt = this._lastSync.asReadonly();

  async init(): Promise<void> {
    await this.db.open();
    await this.refreshSignals();
  }

  // ---------- attendee cache ----------

  /**
   * Replace an event's cached list with a fresh server copy, then re-apply any
   * check-ins the server hasn't confirmed yet so a refresh never "un-checks" someone.
   */
  async saveAttendeeList(eventId: number, rows: Attendee[]): Promise<void> {
    await this.db.batch([
      { statement: 'DELETE FROM attendee WHERE event_id = ?', values: [eventId] },
      ...rows.map((r) => ({
        statement:
          `INSERT INTO attendee (event_id, registration_id, qr_token, first_name, last_name,
                                 attendee_status, payment_status, checked_in_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [eventId, r.registration_id, r.qr_token, r.first_name, r.last_name,
          r.attendee_status, r.payment_status, r.checked_in_at],
      })),
      {
        statement:
          `UPDATE attendee
              SET attendee_status = 'checked_in',
                  checked_in_at = COALESCE(checked_in_at,
                    (SELECT MIN(q.device_time) FROM checkin_queue q
                      WHERE q.event_id = attendee.event_id
                        AND q.registration_id = attendee.registration_id
                        AND q.status = 'pending')),
                  pending = 1
            WHERE event_id = ?
              AND attendee_status = 'not_checked_in'
              AND EXISTS (SELECT 1 FROM checkin_queue q
                           WHERE q.event_id = attendee.event_id
                             AND q.registration_id = attendee.registration_id
                             AND q.status = 'pending')`,
        values: [eventId],
      },
    ]);
  }

  async getAttendees(eventId: number): Promise<Attendee[] | null> {
    const rows = await this.db.query<Attendee>(
      `SELECT registration_id, qr_token, first_name, last_name,
              attendee_status, payment_status, checked_in_at
         FROM attendee WHERE event_id = ? ORDER BY last_name, first_name`,
      [eventId],
    );
    return rows.length ? rows : null;
  }

  async clearAttendees(): Promise<void> {
    await this.db.batch([{ statement: 'DELETE FROM attendee WHERE pending = 0', values: [] }]);
    // Rows with unsynced check-ins are kept on purpose: clearing the cache must not lose them.
  }

  // ---------- outbox ----------

  /** One transaction: outbox row + local attendee flip. A crash can't leave half of it. */
  async checkIn(eventId: number, item: PendingCheckIn): Promise<void> {
    const deviceId = item.device_id ?? await this.deviceId();
    await this.db.batch([
      {
        statement:
          `INSERT OR IGNORE INTO checkin_queue
             (client_id, event_id, registration_id, device_time, device_id, is_offline)
           VALUES (?, ?, ?, ?, ?, ?)`,
        values: [item.client_id, eventId, item.registration_id, item.device_time,
          deviceId, item.is_offline ? 1 : 0],
      },
      {
        statement:
          `UPDATE attendee
              SET attendee_status = 'checked_in', checked_in_at = ?, pending = 1
            WHERE event_id = ? AND registration_id = ? AND attendee_status = 'not_checked_in'`,
        values: [item.device_time, eventId, item.registration_id],
      },
    ]);
    await this.refreshSignals();
  }

  /** Stable per-device id for check_in_log.device_id (Android ID via @capacitor/device). */
  private async deviceId(): Promise<string> {
    const [row] = await this.db.query<{ value: string }>(`SELECT value FROM meta WHERE key = 'device_id'`);
    if (row?.value) return row.value;
    let id: string;
    try { id = (await Device.getId()).identifier; } catch { id = crypto.randomUUID(); }
    await this.db.batch([{ statement: `INSERT OR REPLACE INTO meta (key, value) VALUES ('device_id', ?)`, values: [id] }]);
    return id;
  }

  async pendingBatch(limit = 200): Promise<PendingCheckIn[]> {
    const rows = await this.db.query<Omit<PendingCheckIn, 'is_offline'> & { is_offline: number }>(
      `SELECT client_id, registration_id, device_time, device_id, is_offline
         FROM checkin_queue WHERE status = 'pending'
        ORDER BY device_time LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      client_id: r.client_id,
      registration_id: r.registration_id,
      device_time: r.device_time,
      is_offline: !!r.is_offline,
      ...(r.device_id ? { device_id: r.device_id } : {}),
    }));
  }

  /** Only the client_ids the server answered for are closed; anything else stays pending. */
  async markSynced(results: SyncResult[]): Promise<void> {
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - KEEP_SYNCED_DAYS * 86_400_000).toISOString();
    await this.db.batch([
      ...results.map((r) => ({
        statement:
          `UPDATE checkin_queue SET status = 'synced', result = ?, synced_at = ?, last_error = NULL
            WHERE client_id = ?`,
        values: [r.result, now, r.client_id],
      })),
      {
        statement:
          `UPDATE attendee SET pending = 0
            WHERE pending = 1 AND NOT EXISTS (
              SELECT 1 FROM checkin_queue q
               WHERE q.event_id = attendee.event_id
                 AND q.registration_id = attendee.registration_id
                 AND q.status = 'pending')`,
        values: [],
      },
      { statement: `DELETE FROM checkin_queue WHERE status = 'synced' AND synced_at < ?`, values: [cutoff] },
      { statement: `INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)`, values: [now] },
    ]);
    await this.refreshSignals();
  }

  async markFailed(clientIds: string[], message: string): Promise<void> {
    await this.db.batch(clientIds.map((id) => ({
      statement: `UPDATE checkin_queue SET attempts = attempts + 1, last_error = ? WHERE client_id = ?`,
      values: [message, id],
    })));
  }

  private async refreshSignals(): Promise<void> {
    this._queue.set(await this.pendingBatch(10_000));
    const [m] = await this.db.query<{ value: string }>(`SELECT value FROM meta WHERE key = 'last_sync'`);
    this._lastSync.set(m?.value ? new Date(m.value).toLocaleString() : null);
  }
}
