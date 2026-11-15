import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite, SQLiteConnection, SQLiteDBConnection, capSQLiteSet,
} from '@capacitor-community/sqlite';

const DB_NAME = 'plv_checkin';
const DB_VERSION = 1;

/**
 * Schema v1. (No SQL comments inside: the plugin's statement splitter can choke on them.
 * pending = 1 means a local check-in the server hasn't confirmed; checkin_queue.status is 'pending' | 'synced'.)
 * Append new migrations to MIGRATIONS and bump DB_VERSION;
 * never edit a shipped one.
 */
export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS attendee (
  event_id        INTEGER NOT NULL,
  registration_id INTEGER NOT NULL,
  qr_token        TEXT    NOT NULL,
  first_name      TEXT    NOT NULL,
  last_name       TEXT    NOT NULL,
  attendee_status TEXT    NOT NULL,
  payment_status  TEXT    NOT NULL,
  checked_in_at   TEXT,
  pending         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, registration_id)
);
CREATE INDEX IF NOT EXISTS idx_attendee_token ON attendee (event_id, qr_token);

CREATE TABLE IF NOT EXISTS checkin_queue (
  client_id       TEXT    PRIMARY KEY,
  event_id        INTEGER NOT NULL,
  registration_id INTEGER NOT NULL,
  device_time     TEXT    NOT NULL,
  device_id       TEXT,
  is_offline      INTEGER NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending',
  result          TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  synced_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON checkin_queue (status, device_time);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

/**
 * Owns the single SQLite connection. Everything else asks this for statements to run.
 * Native: real SQLite file. Web (dev only): sql.js through <jeep-sqlite>, persisted to IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class LocalDb {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private conn: SQLiteDBConnection | null = null;
  private opening: Promise<SQLiteDBConnection> | null = null;
  private readonly isWeb = Capacitor.getPlatform() === 'web';

  /** Idempotent: safe to call from every service's ready(). */
  open(): Promise<SQLiteDBConnection> {
    return (this.opening ??= this.doOpen());
  }

  private async doOpen(): Promise<SQLiteDBConnection> {
    if (this.isWeb) {
      if (!document.querySelector('jeep-sqlite')) {
        document.body.appendChild(document.createElement('jeep-sqlite'));
      }
      await customElements.whenDefined('jeep-sqlite');
      await this.sqlite.initWebStore();
    }

    // Reuse the connection after a hot reload instead of throwing "already exists".
    const consistent = (await this.sqlite.checkConnectionsConsistency()).result;
    const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;
    const db = consistent && exists
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

    await db.open();
    await db.execute('PRAGMA foreign_keys = ON;', false);
    await this.migrate(db);
    this.conn = db;
    return db;
  }

  private async migrate(db: SQLiteDBConnection): Promise<void> {
    const row = (await db.query('PRAGMA user_version;')).values?.[0];
    const current = Number(row?.user_version ?? 0);
    if (current < 1) {
      await db.execute(SCHEMA_V1);
      await db.execute('PRAGMA user_version = 1;');
    }
    // if (current < 2) { await db.execute(SCHEMA_V2); await db.execute('PRAGMA user_version = 2;'); }
  }

  async query<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
    const db = await this.open();
    return ((await db.query(sql, values as any[])).values ?? []) as T[];
  }

  /** Runs every statement in ONE transaction: all land or none do. */
  async batch(set: capSQLiteSet[]): Promise<void> {
    if (!set.length) return;
    const db = await this.open();
    await db.executeSet(set, true);
    if (this.isWeb) await this.sqlite.saveToStore(DB_NAME);
  }

  async close(): Promise<void> {
    if (!this.conn) return;
    await this.sqlite.closeConnection(DB_NAME, false);
    this.conn = null;
    this.opening = null;
  }
}
