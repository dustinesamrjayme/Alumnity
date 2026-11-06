// attendees.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { Attendee, EventItem } from '../../../core/models';
import { DateLabelPipe, FeeLabelPipe } from '../../../shared/pipes/format.pipes';
import { attendeesToCsv, downloadCsv } from '../../../shared/utils/csv';

@Component({
  selector: 'app-attendees',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, FeeLabelPipe],
  templateUrl: './attendees.page.html',
  styleUrl: './attendees.page.scss',
})
export class AttendeesPage {
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private events = inject(EventsService);
  private registrations = inject(RegistrationsService);
  private toastCtrl = inject(ToastController);

  q = signal('');
  ev = signal<EventItem | null>(null);
  attendees = signal<Attendee[]>([]);

  list = computed(() => {
    const query = this.q().toLowerCase().trim();
    return this.attendees().filter((a) =>
      !query || (a.first_name + ' ' + a.last_name).toLowerCase().includes(query));
  });

  checkedInCount = computed(() =>
    this.attendees().filter((a) => a.attendee_status === 'checked_in').length);

  constructor() { void this.load(); }

  private async load() {
    this.ev.set(await this.events.get(this.id));
    this.attendees.set(await this.registrations.listForEvent(this.id));
  }

  async download() {
    const ev = this.ev();
    if (!ev) return;
    const csv = attendeesToCsv(this.attendees());
    downloadCsv(`attendees-${ev.id}.csv`, csv);
    await this.toast('CSV downloaded.');
  }

  statusLabel(s: Attendee['attendee_status']): string {
    return s === 'checked_in' ? 'Checked-in' : s === 'cancelled' ? 'Cancelled' : 'Not checked-in';
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}