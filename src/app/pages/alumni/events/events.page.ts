// events.page.ts
import { Component, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { EventCardComponent } from '../../../shared/ui/event-card.component';
import { EventWithAvailability } from '../../../core/models';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [IonContent, EventCardComponent],
  templateUrl: './events.page.html',
  styleUrl: './events.page.scss',
})
export class EventsPage {
  private eventsService = inject(EventsService);
  events = signal<EventWithAvailability[]>([]);

  constructor() { void this.load(); }

  private async load() {
    this.events.set(await this.eventsService.list());
  }
}