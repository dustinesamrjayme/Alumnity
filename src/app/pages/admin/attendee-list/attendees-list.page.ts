// attendees-list.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { EventItem } from '../../../core/models';
import { DateLabelPipe, EventThemePipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-attendees-list',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, EventThemePipe],
  templateUrl: './attendees-list.page.html',
  styleUrl: './attendees-list.page.scss',
})
export class AttendeesListPage {
  private eventsService = inject(EventsService);
  events = signal<EventItem[]>([]);
  q = signal('');

  list = computed(() =>
    this.events().filter((e) => e.name.toLowerCase().includes(this.q().toLowerCase().trim())));

  constructor() { void this.load(); }
  private async load() { this.events.set(await this.eventsService.listAll()); }
}