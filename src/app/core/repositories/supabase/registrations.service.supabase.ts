import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { RegistrationsService } from '../registrations.service';
import { Attendee, MyTicket, Registration } from '../../models';

@Injectable()
export class SupabaseRegistrationsService extends RegistrationsService {
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

  async register(eventId: number): Promise<Registration> {
    return this.unwrap(await this.sb.rpc('register_for_event', { p_event_id: eventId }));
  }

  async cancel(registrationId: number): Promise<Registration> {
    return this.unwrap(await this.sb.rpc('cancel_registration', { p_registration_id: registrationId }));
  }

  async markNoShow(registrationId: number): Promise<Registration> {
    return this.unwrap(await this.sb.rpc('mark_no_show', { p_registration_id: registrationId }));
  }

  async myTickets(): Promise<MyTicket[]> {
    return this.unwrap(
      await this.sb.from('registrations')
        .select('*, event:events(id, name, venue, event_date, price, status, banner_url)')
        .order('created_at', { ascending: false }),
    );
  }

  async listForEvent(eventId: number): Promise<Attendee[]> {
    return this.unwrap(await this.sb.rpc('get_attendee_list', { p_event_id: eventId }));
  }
}