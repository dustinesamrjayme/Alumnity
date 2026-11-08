import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
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
  auth = inject(AuthService);
  private events = inject(EventsService);
  private registrations = inject(RegistrationsService);
  checkIn = inject(CheckInService);
  net = inject(OnlineStatusService);
  private toastCtrl = inject(ToastController);

  id = signal(0);
  ev = signal<EventItem | null>(null);
  attendees = signal<Attendee[]>([]);
  search = signal('');
  offlineCachedOnly = signal(false);
  processingId = signal<number | null>(null);
  isScanning = signal(false);

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
      const cached = await this.checkIn.getCachedAttendeeList(this.id());
      this.attendees.set(cached ?? []);
    }
  }

  async refreshList() {
    if (!this.net.online()) { await this.toast("You're offline."); return; }
    await this.loadAttendees();
    await this.toast('Attendee list refreshed.');
  }

  // --- CAMERA LOGIC ---
  async startScan() {
    try {
      this.isScanning.set(true);
      
      // Request permission
      const permission = await BarcodeScanner.requestPermissions();
      if (permission.camera !== 'granted') {
        await this.toast('Camera permission denied. Use manual entry.');
        return;
      }

      // Open native camera
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });

      if (barcodes.length > 0) {
        const scannedUuid = barcodes[0].rawValue;
        await this.manualLookup(scannedUuid);
      }
    } catch (e) {
      await this.toast('Camera failed to open. Are you on a web browser?');
    } finally {
      this.isScanning.set(false);
    }
  }

  // --- LOOKUP LOGIC ---
    // Rename scanUuid to manualLookup
  async manualLookup(code: string) {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    // Try to find the attendee by UUID, formatted display ID (PLV-00482), or raw integer (482)
    const attendee = this.attendees().find((a) => {
      const formattedId = `PLV-${a.registration_id.toString().padStart(5, '0')}`;
      return a.qr_token === code.trim() || 
             formattedId === cleanCode || 
             a.registration_id.toString() === cleanCode;
    });

    if (!attendee) {
      await this.toast('Invalid ticket code or UUID.');
      return;
    }

    if (attendee.attendee_status === 'checked_in') {
      await this.toast(`${attendee.first_name} is already checked in.`);
      return;
    }

    if (attendee.attendee_status === 'cancelled') {
      await this.toast(`${attendee.first_name}'s ticket is cancelled.`);
      return;
    }

    if (attendee.payment_status === 'unpaid') {
      await this.toast(`${attendee.first_name} has an unpaid balance. Collect payment first.`);
      return;
    }

    await this.checkInNow(attendee);
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
      
      this.attendees.update(list => list.map(x => 
        x.registration_id === a.registration_id 
          ? { ...x, attendee_status: 'checked_in' } 
          : x
      ));

      if (this.net.online()) {
        await this.checkIn.sync();
        await this.toast(`${a.first_name} checked in.`);
        await this.loadAttendees();
      } else {
        await this.toast(`${a.first_name} queued for sync.`);
        await this.checkIn.cacheAttendeeList(this.id(), this.attendees());
      }
    } catch (e) {
      await this.toast((e as Error).message);
      await this.loadAttendees();
    } finally {
      this.processingId.set(null);
    }
  }

  statusLabel(s: Attendee['attendee_status']): string {
    return s === 'checked_in' ? 'Checked-in' : s === 'cancelled' ? 'Cancelled' : 'Not checked-in';
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, position: 'bottom' });
    await t.present();
  }
}