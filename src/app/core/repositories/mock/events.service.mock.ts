import { Injectable, inject } from '@angular/core';
import { MockDatabase } from './mock-database.service';
import { EventsService } from '../events.service';
import {
  EventAvailability, EventItem, EventUpdate, EventWithAvailability, NewEvent,
} from '../../models';

@Injectable()
export class MockEventsService extends EventsService {
  private db = inject(MockDatabase);

  private avail(eventId: number): { registered: number; available: number | null } {
    const s = this.db.state();
    const ev = s.events.find((e) => e.id === eventId);
    if (!ev) return { registered: 0, available: null };
    const registered = s.registrations
      .filter((r) => r.event_id === eventId && r.attendee_status !== 'cancelled').length;
    const available = ev.capacity == null ? null : Math.max(ev.capacity - registered, 0);
    return { registered, available };
  }

  async list(): Promise<EventWithAvailability[]> {
    await this.db.ensureLoaded();
    return this.db.state().events
      .filter((e) => e.status === 'listed')
      .map((e) => ({ ...e, ...this.avail(e.id) }));
  }

  async listAll(): Promise<EventItem[]> {
    await this.db.ensureLoaded();
    return [...this.db.state().events];
  }

  async get(id: number): Promise<EventItem> {
    await this.db.ensureLoaded();
    const ev = this.db.state().events.find((e) => e.id === id);
    if (!ev) throw new Error('Event not found.');
    return ev;
  }

  async availability(eventId: number): Promise<EventAvailability> {
    await this.db.ensureLoaded();
    const ev = await this.get(eventId);
    return { event_id: eventId, capacity: ev.capacity, ...this.avail(eventId) };
  }

  async create(e: NewEvent): Promise<EventItem> {
    await this.db.ensureLoaded();
    const id = this.db.state().nextEventId;
    const item: EventItem = {
      ...e, id, status: 'listed', created_by: this.db.state().currentUserId, closed_at: null,
    };
    this.db.update((s) => ({
      ...s, events: [...s.events, item], nextEventId: id + 1,
    }));
    return item;
  }

  async update(id: number, changes: EventUpdate): Promise<EventItem> {
    await this.db.ensureLoaded();
    let updated: EventItem | null = null;
    this.db.update((s) => ({
      ...s,
      events: s.events.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...changes };
        return updated;
      }),
    }));
    if (!updated) throw new Error('Event not found.');
    return updated;
  }

  async close(id: number): Promise<EventItem> {
    return this.setStatus(id, 'closed');
  }

  async reopen(id: number): Promise<EventItem> {
    return this.setStatus(id, 'listed');
  }

  private async setStatus(id: number, status: 'listed' | 'closed'): Promise<EventItem> {
    await this.db.ensureLoaded();
    let updated: EventItem | null = null;
    this.db.update((s) => ({
      ...s,
      events: s.events.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, status, closed_at: status === 'closed' ? new Date().toISOString() : null };
        return updated;
      }),
    }));
    if (!updated) throw new Error('Event not found.');
    return updated;
  }

  async finalize(id: number): Promise<EventItem> {
    await this.db.ensureLoaded();
    const cancelled = this.db.state().registrations
      .filter((r) => r.event_id === id && r.attendee_status === 'not_checked_in')
      .map((r) => r.id);
    const cancelledSet = new Set(cancelled);
    this.db.update((s) => ({
      ...s,
      registrations: s.registrations.map((r) =>
        cancelledSet.has(r.id) ? { ...r, attendee_status: 'cancelled' } : r),
      events: s.events.map((e) => e.id === id ? {
        ...e, status: 'closed', closed_at: e.closed_at ?? new Date().toISOString(),
      } : e),
    }));
    return this.get(id);
  }
}