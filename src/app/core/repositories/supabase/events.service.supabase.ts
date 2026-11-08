import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { EventsService } from '../events.service';
import {
  EventAvailability, EventItem, EventUpdate, EventWithAvailability, NewEvent,
} from '../../models';

@Injectable()
export class SupabaseEventsService extends EventsService {
  private sb: SupabaseClient = createClient(
    environment.supabaseUrl, environment.supabaseAnonKey,
  );

  private unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
    if (res.error) {
      const err = new Error(res.error.message) as Error & { code?: string };
      err.code = res.error.code;
      throw err;
    }
    return res.data as T;
  }

  async list(): Promise<EventWithAvailability[]> {
    const rows = this.unwrap(
      await this.sb.rpc('get_events_with_availability'),
    ) as EventWithAvailability[];
    return rows.filter((e) => e.status === 'listed');
  }

  async listAll(): Promise<EventItem[]> {
    return this.unwrap(
      await this.sb.from('events').select('*').order('event_date', { ascending: true }),
    );
  }

  async get(id: number): Promise<EventItem> {
    return this.unwrap(await this.sb.from('events').select('*').eq('id', id).single<EventItem>());
  }

  async availability(eventId: number): Promise<EventAvailability> {
    const rows = this.unwrap(
      await this.sb.rpc('get_event_availability', { p_event_id: eventId }),
    ) as EventAvailability[];
    if (!rows.length) throw new Error('Event not found.');
    return rows[0];
  }

  async create(e: NewEvent): Promise<EventItem> {
    return this.unwrap(await this.sb.from('events').insert(e).select().single<EventItem>());
  }

  async update(id: number, changes: EventUpdate): Promise<EventItem> {
    return this.unwrap(
      await this.sb.from('events').update(changes).eq('id', id).select().single<EventItem>(),
    );
  }

  async close(id: number): Promise<EventItem> {
    return this.unwrap(
      await this.sb.from('events').update({ status: 'closed' }).eq('id', id).select().single<EventItem>(),
    );
  }

  async reopen(id: number): Promise<EventItem> {
    return this.unwrap(
      await this.sb.from('events').update({ status: 'listed' }).eq('id', id).select().single<EventItem>(),
    );
  }

  async finalize(id: number): Promise<EventItem> {
    this.unwrap(await this.sb.rpc('finalize_event', { p_event_id: id }));
    return this.get(id);
  }
}