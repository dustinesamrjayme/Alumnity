// attendees.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { Attendee, EventItem } from '../../../core/models';
import { DateLabelPipe } from '../../../shared/pipes/format.pipes';
import { attendeesToCsv, downloadCsv } from '../../../shared/utils/csv';

@Component({
  selector: 'app-volunteer-attendees',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe],
  templateUrl: './attendees.page.html',
  styleUrl: './attendees.page.scss',
})
export class VolunteerAttendeesPage {
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private events = inject(EventsService);
  private registrations = inject(RegistrationsService);
  private toastCtrl = inject(ToastController);

  ev = signal<EventItem | null>(null);
  attendees = signal<Attendee[]>([]);
  finalizing = signal(false);

  counts = computed(() => {
    const rows = this.attendees();
    return {
      total: rows.length,
      in: rows.filter((a) => a.attendee_status === 'checked_in').length,
      out: rows.filter((a) => a.attendee_status === 'not_checked_in').length,
      cancelled: rows.filter((a) => a.attendee_status === 'cancelled').length,
    };
  });

  constructor() { void this.load(); }

  private async load() {
    this.ev.set(await this.events.get(this.id));
    this.attendees.set(await this.registrations.listForEvent(this.id));
  }

  async markNoShow(a: Attendee) {
    try {
      await this.registrations.markNoShow(a.registration_id);
      await this.toast(`${a.first_name} marked as no-show.`);
      await this.load();
    } catch (e) { await this.toast((e as Error).message); }
  }

  async download() {
    const ev = this.ev();
    if (!ev) return;
    downloadCsv(`attendees-${ev.id}.csv`, attendeesToCsv(this.attendees()));
    await this.toast('CSV downloaded.');
  }

  async finalize() {
    this.finalizing.set(true);
    try {
      await this.events.finalize(this.id);
      await this.toast('Event finalized; no-shows cancelled.');
      await this.load();
    } catch (e) { await this.toast((e as Error).message); }
    finally { this.finalizing.set(false); }
  }

  statusLabel(s: Attendee['attendee_status']): string {
    return s === 'checked_in' ? 'Checked-in' : s === 'cancelled' ? 'Cancelled' : 'Not checked-in';
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}