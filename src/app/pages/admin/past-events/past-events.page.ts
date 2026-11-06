// past-events.page.ts
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { AdminService } from '../../../core/repositories/admin.service';
import { DateLabelPipe } from '../../../shared/pipes/format.pipes';

interface PastRow {
  id: number; name: string; venue: string; event_date: string;
  registered: number; checked_in: number; fillPct: number;
}

@Component({
  selector: 'app-past-events',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe],
  templateUrl: './past-events.page.html',
  styleUrl: './past-events.page.scss',
})
export class PastEventsPage {
  private events = inject(EventsService);
  private admin = inject(AdminService);
  rows = signal<PastRow[]>([]);

  constructor() { void this.load(); }

  private async load() {
    const [events, stats] = await Promise.all([this.events.listAll(), this.admin.dashboard()]);
    this.rows.set(
      events.filter((e) => e.status === 'closed').map((e) => {
        const s = stats.find((s) => s.event_id === e.id);
        const registered = s?.registered ?? 0;
        const checked_in = s?.checked_in ?? 0;
        return {
          id: e.id, name: e.name, venue: e.venue, event_date: e.event_date,
          registered, checked_in,
          fillPct: registered > 0 ? (checked_in / registered) * 100 : 0,
        };
      }),
    );
  }
}