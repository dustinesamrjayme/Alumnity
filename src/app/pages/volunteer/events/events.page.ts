// events.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { EventItem } from '../../../core/models';
import { DateLabelPipe, FeeLabelPipe, EventThemePipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-volunteer-events',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, FeeLabelPipe, EventThemePipe],
  templateUrl: './events.page.html',
  styleUrl: './events.page.scss',
})
export class VolunteerEventsPage {
  private eventsService = inject(EventsService);
  events = signal<EventItem[]>([]);
  q = signal('');

  list = computed(() =>
    this.events().filter((e) => e.name.toLowerCase().includes(this.q().toLowerCase().trim())));

  constructor() { void this.load(); }
  private async load() { this.events.set(await this.eventsService.listAll()); }
}