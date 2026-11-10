// past-events.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { AdminService } from '../../../core/repositories/admin.service';
import { EventDashboardStats } from '../../../core/models';
import { DateLabelPipe } from '../../../shared/pipes/format.pipes';
import { isArchived } from '../../../shared/utils/event-state';

type FeeFilter = 'all' | 'free' | 'paid';
type SortKey = 'newest' | 'oldest' | 'name' | 'registered' | 'attendance_high' | 'attendance_low';

interface PastRow {
  id: number;
  name: string;
  venue: string;
  event_date: string;
  time: number;
  year: number;
  paid: boolean;
  registered: number;
  checked_in: number;
  attendancePct: number;
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
  loading = signal(true);

  // filter + sort state
  query = signal('');
  year = signal('all');
  fee = signal<FeeFilter>('all');
  sort = signal<SortKey>('newest');

  constructor() { void this.load(); }

  private async load() {
    try {
      const [events, stats] = await Promise.all([
        this.events.listAll(),
        this.admin.dashboard().catch(() => [] as EventDashboardStats[]),
      ]);
      this.rows.set(
        events
          .filter((e) => isArchived(e, stats.find((s) => s.event_id === e.id)))
          .map((e) => {
            const s = stats.find((x) => x.event_id === e.id);
            const registered = s?.registered ?? 0;
            const checked_in = s?.checked_in ?? 0;
            const d = new Date(e.event_date);
            return {
              id: e.id,
              name: e.name,
              venue: e.venue,
              event_date: e.event_date,
              time: d.getTime(),
              year: d.getFullYear(),
              paid: (e.price ?? 0) > 0,
              registered,
              checked_in,
              attendancePct: registered > 0 ? Math.round((checked_in / registered) * 100) : 0,
            };
          }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  years = computed(() =>
    [...new Set(this.rows().map((r) => r.year))].sort((a, b) => b - a));

  hasFilters = computed(() =>
    this.query().trim() !== '' || this.year() !== 'all' || this.fee() !== 'all');

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const year = this.year();
    const fee = this.fee();

    const list = this.rows().filter((r) => {
      if (year !== 'all' && r.year !== Number(year)) return false;
      if (fee === 'free' && r.paid) return false;
      if (fee === 'paid' && !r.paid) return false;
      if (q && !(r.name.toLowerCase().includes(q) || r.venue.toLowerCase().includes(q))) return false;
      return true;
    });

    const by: Record<SortKey, (a: PastRow, b: PastRow) => number> = {
      newest: (a, b) => b.time - a.time,
      oldest: (a, b) => a.time - b.time,
      name: (a, b) => a.name.localeCompare(b.name),
      registered: (a, b) => b.registered - a.registered,
      attendance_high: (a, b) => b.attendancePct - a.attendancePct,
      attendance_low: (a, b) => a.attendancePct - b.attendancePct,
    };
    return [...list].sort(by[this.sort()]);
  });

  clearFilters() {
    this.query.set('');
    this.year.set('all');
    this.fee.set('all');
  }
}
