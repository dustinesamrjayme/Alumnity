// admin-events.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, ToastController } from '@ionic/angular/standalone';
import { AdminService } from '../../../core/repositories/admin.service';
import { EventsService } from '../../../core/repositories/events.service';
import { EventDashboardStats, EventItem } from '../../../core/models';
import { DateLabelPipe, FeeLabelPipe } from '../../../shared/pipes/format.pipes';
import { isArchived, isPast, needsFinalize } from '../../../shared/utils/event-state';

type State = 'open' | 'full' | 'closed' | 'finalize';
type StatusFilter = 'all' | State;
type FeeFilter = 'all' | 'free' | 'paid';
type SortKey = 'date_asc' | 'date_desc' | 'name' | 'registered' | 'fill';

interface EventRow {
  event: EventItem;
  registered: number;
  capacity: number;
  fill: number;
  state: State;
  label: string;
  finalize: boolean;
}

const LABELS: Record<State, string> = {
  open: 'Open',
  full: 'Full',
  closed: 'Closed',
  finalize: 'Ended',
};

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, FeeLabelPipe],
  templateUrl: './admin-events.page.html',
  styleUrl: './admin-events.page.scss',
})
export class AdminEventsPage {
  private eventsService = inject(EventsService);
  private admin = inject(AdminService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  events = signal<EventItem[]>([]);
  stats = signal<EventDashboardStats[]>([]);
  loading = signal(true);

  // filter + sort state
  query = signal('');
  status = signal<StatusFilter>('all');
  fee = signal<FeeFilter>('all');
  sort = signal<SortKey>('date_asc');

  statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'full', label: 'Full' },
    { key: 'closed', label: 'Closed' },
    { key: 'finalize', label: 'Needs finalizing' },
  ];

  constructor() { void this.load(); }

  private async load() {
    try {
      const [events, stats] = await Promise.all([
        this.eventsService.listAll(),
        this.admin.dashboard().catch(() => [] as EventDashboardStats[]),
      ]);
      this.events.set(events);
      this.stats.set(stats);
    } catch (err) {
      await this.toast((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  private statFor(id: number) {
    return this.stats().find((s) => s.event_id === id);
  }

  // Active = upcoming, plus past events that still need finalizing.
  // Finalized past events live on the Past events page.
  rows = computed<EventRow[]>(() =>
    this.events()
      .filter((e) => !isArchived(e, this.statFor(e.id)))
      .map((e) => {
        const s = this.statFor(e.id);
        const registered = s?.registered ?? 0;
        const capacity = e.capacity ?? 0;
        const finalize = needsFinalize(e, s);
        const listed = e.status === 'listed';
        const state: State = finalize ? 'finalize'
          : !listed ? 'closed'
          : capacity > 0 && registered >= capacity ? 'full'
          : 'open';
        return {
          event: e,
          registered,
          capacity,
          fill: capacity > 0 ? Math.min(100, (registered / capacity) * 100) : 0,
          state,
          label: LABELS[state],
          finalize,
        };
      }),
  );

  archivedCount = computed(() => this.events().length - this.rows().length);

  counts = computed(() => {
    const r = this.rows();
    return {
      all: r.length,
      open: r.filter((x) => x.state === 'open').length,
      full: r.filter((x) => x.state === 'full').length,
      closed: r.filter((x) => x.state === 'closed').length,
      finalize: r.filter((x) => x.state === 'finalize').length,
    } as Record<StatusFilter, number>;
  });

  hasFilters = computed(() =>
    this.query().trim() !== '' || this.status() !== 'all' || this.fee() !== 'all');

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const st = this.status();
    const fee = this.fee();

    const list = this.rows().filter((r) => {
      if (st !== 'all' && r.state !== st) return false;
      const paid = (r.event.price ?? 0) > 0;
      if (fee === 'free' && paid) return false;
      if (fee === 'paid' && !paid) return false;
      if (q && !(r.event.name.toLowerCase().includes(q) || r.event.venue.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });

    const time = (r: EventRow) => new Date(r.event.event_date).getTime();
    const by: Record<SortKey, (a: EventRow, b: EventRow) => number> = {
      date_asc: (a, b) => time(a) - time(b),
      date_desc: (a, b) => time(b) - time(a),
      name: (a, b) => a.event.name.localeCompare(b.event.name),
      registered: (a, b) => b.registered - a.registered,
      fill: (a, b) => b.fill - a.fill,
    };
    return [...list].sort(by[this.sort()]);
  });

  clearFilters() {
    this.query.set('');
    this.status.set('all');
    this.fee.set('all');
  }

  isPast(e: EventItem) { return isPast(e); }

  async toggle(e: EventItem) {
    try {
      await (e.status === 'listed'
        ? this.eventsService.close(e.id)
        : this.eventsService.reopen(e.id));
      await this.toast(e.status === 'listed' ? 'Registration closed.' : 'Registration reopened.');
      await this.load();
    } catch (err) { await this.toast((err as Error).message); }
  }

  async finalize(e: EventItem) {
    const alert = await this.alertCtrl.create({
      header: 'Finalize this event?',
      message: `Everyone who hasn't checked in to "${e.name}" will be marked as cancelled and registration will close.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Finalize', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    try {
      await this.eventsService.finalize(e.id);
      await this.toast('Event finalized; moved to past events.');
      await this.load();
    } catch (err) { await this.toast((err as Error).message); }
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
