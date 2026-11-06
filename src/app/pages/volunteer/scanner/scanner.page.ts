// scanner.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/repositories/auth.service';
import { EventsService } from '../../../core/repositories/events.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { CheckInService } from '../../../core/repositories/checkin.service';
import { OnlineStatusService } from '../../../core/online-status.service';
import { Attendee, EventItem, PendingCheckIn } from '../../../core/models';
import { DateLabelPipe, FeeLabelPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-volunteer-scanner',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, FeeLabelPipe],
  templateUrl: './scanner.page.html',
  styleUrl: './scanner.page.scss',
})
export class VolunteerScannerPage {
  private route = inject(ActivatedRoute);
  private events = inject(EventsService);
  private registrations = inject(RegistrationsService);
  private toastCtrl = inject(ToastController);
  checkIn = inject(CheckInService);
  auth = inject(AuthService);
  net = inject(OnlineStatusService);
  processingId = signal<number | null>(null);

  id = signal(0);
  ev = signal<EventItem | null>(null);
  attendees = signal<Attendee[]>([]);
  search = signal('');
  offlineCachedOnly = signal(false);

  list = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.attendees().filter((a) =>
      !q || (a.first_name + ' ' + a.last_name).toLowerCase().includes(q));
  });

  constructor() { void this.init(); }

  private async init() {
    const n = Number(this.route.snapshot.paramMap.get('id'));
    if (!n || Number.isNaN(n)) return;
    this.id.set(n);
    await this.auth.ready();
    try { this.ev.set(await this.events.get(n)); } catch { /* offline: no event data */ }
    await this.loadAttendees();
  }

  private async loadAttendees() {
    if (!this.net.online()) {
      const cached = await this.checkIn.getCachedAttendeeList(this.id());
      this.attendees.set(cached ?? []);
      this.offlineCachedOnly.set(!!cached);
      return;
    }

    try {
      const fresh = await this.registrations.listForEvent(this.id());
      await this.checkIn.cacheAttendeeList(this.id(), fresh);
      this.attendees.set(fresh);
      this.offlineCachedOnly.set(false);
    } catch {
      // Fallback to cache if network fails mid-session
      const cached = await this.checkIn.getCachedAttendeeList(this.id());
      this.attendees.set(cached ?? []);
    }
  }

  async refreshList() {
    if (!this.net.online()) { await this.toast("You're offline."); return; }
    const fresh = await this.registrations.listForEvent(this.id());
    await this.checkIn.cacheAttendeeList(this.id(), fresh);
    this.attendees.set(fresh);
    await this.toast('Attendee list refreshed.');
  }

  async collectPayment(a: Attendee) {
    if (!this.net.online()) { await this.toast('Come online to collect payment.'); return; }
    try {
      await this.checkIn.confirmPayment(a.registration_id);
      await this.toast(`${a.first_name} paid. Now check them in.`);
      await this.loadAttendees();
    } catch (e) { await this.toast((e as Error).message); }
  }

   async checkInNow(a: Attendee) {
    if (this.processingId() !== null) return; // Prevent double clicks
    this.processingId.set(a.registration_id);

    const item: PendingCheckIn = {
      client_id: crypto.randomUUID(),
      registration_id: a.registration_id,
      device_time: new Date().toISOString(),
      is_offline: !this.net.online(),
    };

    try {
      await this.checkIn.enqueue(item);
      
      // Optimistic UI update: instantly change the pill to "Checked-in"
      this.attendees.update(list => list.map(x => 
        x.registration_id === a.registration_id 
          ? { ...x, attendee_status: 'checked_in' } 
          : x
      ));

      if (this.net.online()) {
        await this.checkIn.sync();
        await this.toast(`${a.first_name} checked in.`);
        await this.loadAttendees(); // Fetch the confirmed state from DB
      } else {
        await this.toast(`${a.first_name} queued for sync.`);
        // Save the optimistic state to cache so it survives a reload
        await this.checkIn.cacheAttendeeList(this.id(), this.attendees());
      }
    } catch (e) {
      await this.toast((e as Error).message);
      await this.loadAttendees(); // Revert UI if it failed
    } finally {
      this.processingId.set(null);
    }
  }
  
  statusLabel(s: Attendee['attendee_status']): string {
    return s === 'checked_in' ? 'Checked-in' : s === 'cancelled' ? 'Cancelled' : 'Not checked-in';
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}