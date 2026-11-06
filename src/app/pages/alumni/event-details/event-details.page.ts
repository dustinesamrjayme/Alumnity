// event-details.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { EventAvailability, EventItem, MyTicket } from '../../../core/models';
import { DateLabelPipe, LongDatePipe, TimeLabelPipe, FeeLabelPipe, EventThemePipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, LongDatePipe, TimeLabelPipe, FeeLabelPipe, EventThemePipe],
  templateUrl: './event-details.page.html',
  styleUrl: './event-details.page.scss',
})
export class EventDetailsPage {
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private events = inject(EventsService);
  private registrations = inject(RegistrationsService);

  ev = signal<EventItem | null>(null);
  availability = signal<EventAvailability | null>(null);
  existing = signal<MyTicket | null>(null);
  loading = signal(true);

  fillPercent = computed(() => {
    const a = this.availability();
    if (!a || !a.capacity) return 0;
    return Math.min(100, Math.round((a.registered / a.capacity) * 100));
  });

  constructor() { void this.load(); }

  private async load() {
    if (!this.id || Number.isNaN(this.id)) { this.loading.set(false); return; }
    try {
      this.ev.set(await this.events.get(this.id));
      this.availability.set(await this.events.availability(this.id));
      const tickets = await this.registrations.myTickets();
      this.existing.set(tickets.find((t) => t.event_id === this.id) ?? null);
    } catch { this.ev.set(null); }
    finally { this.loading.set(false); }
  }
}