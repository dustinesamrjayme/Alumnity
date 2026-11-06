import { Injectable, inject } from '@angular/core';
import { MockDatabase } from './mock-database.service';
import { RegistrationsService } from '../registrations.service';
import { Attendee, MyTicket, Registration } from '../../models';

@Injectable()
export class MockRegistrationsService extends RegistrationsService {
  private db = inject(MockDatabase);

  private current(): { uid: string; role: string } {
    const user = this.db.currentUser();
    if (!user) throw new Error('Not signed in.');
    return { uid: user.id, role: user.role };
  }

  async register(eventId: number): Promise<Registration> {
    await this.db.ensureLoaded();
    const { uid } = this.current();
    const s = this.db.state();
    const ev = s.events.find((e) => e.id === eventId);
    if (!ev) throw new Error('Event not found.');
    if (ev.status !== 'listed') throw new Error('Event is closed.');

    const registered = s.registrations
      .filter((r) => r.event_id === eventId && r.attendee_status !== 'cancelled').length;
    if (ev.capacity != null && registered >= ev.capacity) throw new Error('Event is full.');

    const dup = s.registrations.some((r) =>
      r.event_id === eventId && r.user_id === uid && r.attendee_status !== 'cancelled');
    if (dup) throw new Error('You already have a ticket for this event.');

    const payment = (ev.price ?? 0) === 0 ? 'free' as const : 'unpaid' as const;
    const reg: Registration = {
      id: s.nextRegistrationId, event_id: eventId, user_id: uid,
      attendee_status: 'not_checked_in', payment_status: payment,
      checked_in_at: null, payment_collected_by: null, payment_collected_at: null,
      created_at: new Date().toISOString(),
      qr_token: crypto.randomUUID(),
    };
    this.db.update((st) => ({
      ...st, registrations: [...st.registrations, reg],
      nextRegistrationId: st.nextRegistrationId + 1,
    }));
    return reg;
  }

  async cancel(registrationId: number): Promise<Registration> {
    await this.db.ensureLoaded();
    const { uid, role } = this.current();
    const s = this.db.state();
    const reg = s.registrations.find((r) => r.id === registrationId);
    if (!reg) throw new Error('Registration not found.');
    if (reg.user_id !== uid && role !== 'admin') throw new Error('Not allowed.');
    if (reg.attendee_status === 'checked_in') throw new Error('Already checked in.');
    if (reg.attendee_status === 'cancelled') return reg;
    let updated: Registration = { ...reg, attendee_status: 'cancelled' };
    this.db.update((st) => ({
      ...st, registrations: st.registrations.map((r) => r.id === registrationId ? updated : r),
    }));
    return updated;
  }

  async markNoShow(registrationId: number): Promise<Registration> {
    await this.db.ensureLoaded();
    const { role } = this.current();
    if (role !== 'admin' && role !== 'volunteer') throw new Error('Not allowed.');
    const reg = this.db.state().registrations.find((r) => r.id === registrationId);
    if (!reg) throw new Error('Registration not found.');
    if (reg.attendee_status === 'checked_in') throw new Error('Already checked in.');
    if (reg.attendee_status === 'cancelled') return reg;
    const updated: Registration = { ...reg, attendee_status: 'cancelled' };
    this.db.update((st) => ({
      ...st, registrations: st.registrations.map((r) => r.id === registrationId ? updated : r),
    }));
    return updated;
  }

  async myTickets(): Promise<MyTicket[]> {
    await this.db.ensureLoaded();
    const { uid } = this.current();
    const s = this.db.state();
    return s.registrations
      .filter((r) => r.user_id === uid)
      .map((r) => {
        const ev = s.events.find((e) => e.id === r.event_id);
        if (!ev) return null;
        return {
          ...r,
          event: {
            id: ev.id, name: ev.name, venue: ev.venue, event_date: ev.event_date,
            price: ev.price, status: ev.status, banner_url: ev.banner_url,
          },
        };
      })
      .filter((t): t is MyTicket => t !== null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listForEvent(eventId: number): Promise<Attendee[]> {
    await this.db.ensureLoaded();
    const { role } = this.current();
    if (role !== 'admin' && role !== 'volunteer') throw new Error('Not allowed.');
    const s = this.db.state();
    return s.registrations
      .filter((r) => r.event_id === eventId)
      .map((r) => {
        const u = s.users.find((u) => u.id === r.user_id);
        if (!u) return null;
        return {
          registration_id: r.id, qr_token: r.qr_token,
          first_name: u.first_name, last_name: u.last_name,
          attendee_status: r.attendee_status, payment_status: r.payment_status,
          checked_in_at: r.checked_in_at,
        } as Attendee;
      })
      .filter((a): a is Attendee => a !== null)
      .sort((a, b) => a.last_name.localeCompare(b.last_name));
  }
}