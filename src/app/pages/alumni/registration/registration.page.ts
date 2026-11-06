// registration.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/repositories/auth.service';
import { EventsService } from '../../../core/repositories/events.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { EventAvailability, EventItem, MyTicket } from '../../../core/models';
import { FeeLabelPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [IonContent, RouterLink, FeeLabelPipe],
  templateUrl: './registration.page.html',
  styleUrl: './registration.page.scss',
})
export class RegistrationPage {
  auth = inject(AuthService);
  private events = inject(EventsService);
  private registrations = inject(RegistrationsService);
  private router = inject(Router);

  id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  ev = signal<EventItem | null>(null);
  availability = signal<EventAvailability | null>(null);
  existing = signal<MyTicket | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);

  profileComplete = computed(() => {
    const u = this.auth.currentUser();
    return !!(u && u.first_name && u.last_name && u.username && u.phone && u.department && u.program && u.batch);
  });

  constructor() { void this.load(); }

  private async load() {
    if (!this.id || Number.isNaN(this.id)) { this.loading.set(false); return; }
    await this.auth.ready();
    try {
      this.ev.set(await this.events.get(this.id));
      this.availability.set(await this.events.availability(this.id));
      const tickets = await this.registrations.myTickets();
      this.existing.set(tickets.find((t) => t.event_id === this.id) ?? null);
    } catch { this.ev.set(null); }
    finally { this.loading.set(false); }
  }

  async register() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const reg = await this.registrations.register(this.id);
      await this.router.navigate(
        ['/tabs/events', this.id, 'success', reg.id],
        { replaceUrl: true },
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally { this.busy.set(false); }
  }
}