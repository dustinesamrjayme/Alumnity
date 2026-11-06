import { Signal } from '@angular/core';
import { Attendee, CheckInLogEntry, PendingCheckIn, Registration, SyncResult } from '../models';

export abstract class CheckInService {
  abstract readonly queue: Signal<PendingCheckIn[]>;
  abstract readonly pendingCount: Signal<number>;
  abstract readonly lastSyncAt: Signal<string | null>;

  abstract ready(): Promise<void>;
  abstract confirmPayment(registrationId: number): Promise<Registration>;
  abstract enqueue(item: PendingCheckIn): Promise<void>;
  abstract sync(): Promise<SyncResult[]>;
  abstract log(eventId: number): Promise<CheckInLogEntry[]>;
  abstract cacheAttendeeList(eventId: number, rows: Attendee[]): Promise<void>;
  abstract getCachedAttendeeList(eventId: number): Promise<Attendee[] | null>;
  abstract clearCachedLists(): Promise<void>;
}