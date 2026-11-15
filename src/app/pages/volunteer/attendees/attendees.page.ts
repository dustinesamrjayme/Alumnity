import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { CheckInService } from '../../../core/repositories/checkin.service';
import { OnlineStatusService } from '../../../core/online-status.service';
import { Attendee, EventItem, PendingCheckIn } from '../../../core/models';
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
  private checkIn = inject(CheckInService);
  net = inject(OnlineStatusService);
  private toastCtrl = inject(ToastController);

  ev = signal<EventItem | null>(null);
  attendees = signal<Attendee[]>([]);
  finalizing = signal(false);
  processingId = signal<number | null>(null);

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
    if (!this.net.online()) {
      const cached = await this.checkIn.getCachedAttendeeList(this.id);
      this.attendees.set(cached ?? []);
    } else {
      const fresh = await this.registrations.listForEvent(this.id);
      await this.checkIn.cacheAttendeeList(this.id, fresh);
      this.attendees.set(fresh);
    }
  }

  async checkInNow(a: Attendee) {
    if (this.processingId() !== null) return;
    this.processingId.set(a.registration_id);

    const item: PendingCheckIn = {
      client_id: crypto.randomUUID(),
      registration_id: a.registration_id,
      device_time: new Date().toISOString(),
      is_offline: !this.net.online(),
    };

    try {
      await this.checkIn.enqueue(item);
      
      // Optimistic UI update
      this.attendees.update(list => list.map(x => 
        x.registration_id === a.registration_id 
          ? { 
              ...x, 
              attendee_status: 'checked_in',
              payment_status: x.payment_status === 'unpaid' ? 'paid' : x.payment_status
            } 
          : x
      ));

      if (this.net.online()) {
        await this.checkIn.sync();
        await this.toast(`${a.first_name} checked in.`);
        await this.load();
      } else {
        await this.toast(`${a.first_name} queued for sync.`);
        await this.checkIn.cacheAttendeeList(this.id, this.attendees());
      }
    } catch (e) {
      await this.toast((e as Error).message);
      await this.load();
    } finally {
      this.processingId.set(null);
    }
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