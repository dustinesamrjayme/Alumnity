// dashboard.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, ToastController } from '@ionic/angular/standalone';
import { AdminService, AlumniSummary } from '../../../core/repositories/admin.service';
import { EventsService } from '../../../core/repositories/events.service';
import { EventDashboardStats, EventItem } from '../../../core/models';

// events.status is 'listed' | 'closed' in the DB; the rest is derived from date + capacity.
type EventStatus = 'open' | 'full' | 'ended' | 'closed';
type Filter = 'upcoming' | 'open' | 'past' | 'all';

interface AttentionItem {
  tone: 'warn' | 'info' | 'bad';
  text: string;
  cta: string;
  link?: string | any[];
  action?: 'finalize';
}

// Chart geometry
const X0 = 40, X1 = 600, Y_TOP = 30, Y_BASE = 190;
const R = 52;
const CIRC = 2 * Math.PI * R;

// If your `registered` stat already EXCLUDES cancelled registrations, leave this false.
// If it counts every row (cancelled included), set it to true and the numbers correct themselves.
const REGISTERED_INCLUDES_CANCELLED = false;

// Same default grace period as finalize_past_events(p_grace_hours) in the database.
const GRACE_HOURS = 12;

const STATUS_META: Record<EventStatus, { label: string; pill: string }> = {
  open: { label: 'Open', pill: 'pg' },
  full: { label: 'Full', pill: 'pr' },
  ended: { label: 'Ended', pill: 'pa' },   // date passed, still 'listed' (not finalized yet)
  closed: { label: 'Closed', pill: 'pf' },
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonContent, RouterLink, DatePipe],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private admin = inject(AdminService);
  private eventsService = inject(EventsService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  circ = CIRC;
  filters: { key: Filter; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'open', label: 'Open' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ];

  events = signal<EventItem[]>([]);
  stats = signal<EventDashboardStats[]>([]);
  alumni = signal<AlumniSummary | null>(null);
  filter = signal<Filter>('upcoming');
  finalizing = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() { void this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [evs, sts, alumni] = await Promise.all([
        this.eventsService.listAll(),
        this.admin.dashboard(),
        this.admin.alumniSummary().catch(() => null), // alumni cards degrade gracefully
      ]);
      this.events.set(evs);
      this.stats.set(sts);
      this.alumni.set(alumni);
    } catch (e) {
      this.error.set((e as Error).message || 'Could not load the dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  // ---------- helpers ----------
  statFor(eventId: number) {
    return this.stats().find((s) => s.event_id === eventId);
  }

  private dateOf(e: EventItem): Date | null {
    if (!e.event_date) return null;
    const d = new Date(e.event_date);
    return isNaN(+d) ? null : d;
  }

  private active(s?: EventDashboardStats): number {
    if (!s) return 0;
    return Math.max(s.registered - (REGISTERED_INCLUDES_CANCELLED ? s.cancelled : 0), 0);
  }

  // ---------- per-event rows ----------
  rows = computed(() => {
    const now = Date.now();
    return this.events().map((e) => {
      const s = this.statFor(e.id);
      const registered = this.active(s);
      const checkedIn = s?.checked_in ?? 0;
      const cancelled = s?.cancelled ?? 0;
      const capacity = e.capacity ?? 0;
      const fill = capacity > 0 ? Math.min(100, (registered / capacity) * 100) : 0;
      const date = this.dateOf(e);
      const isPast = !!date && date.getTime() < now;
      const listed = (e.status as string) === 'listed';
      // Mirrors the condition used by finalize_past_events in SQL.
      const needsFinalize = !!date
        && date.getTime() < now - GRACE_HOURS * 3600 * 1000
        && (listed || registered > checkedIn);

      let status: EventStatus;
      if (!listed) status = 'closed';
      else if (isPast) status = 'ended';
      else if (capacity > 0 && registered >= capacity) status = 'full';
      else status = 'open';

      return {
        id: e.id,
        name: e.name,
        date,
        isPast,
        needsFinalize,
        registered,
        checkedIn,
        cancelled,
        capacity,
        fill,
        status,
        statusLabel: STATUS_META[status].label,
        pill: STATUS_META[status].pill,
      };
    });
  });

  filterCounts = computed(() => {
    const r = this.rows();
    return {
      upcoming: r.filter((x) => !x.isPast).length,
      open: r.filter((x) => x.status === 'open' || x.status === 'full').length,
      past: r.filter((x) => x.isPast).length,
      all: r.length,
    } as Record<Filter, number>;
  });

  tableRows = computed(() => {
    const f = this.filter();
    const list = this.rows().filter((r) => {
      if (f === 'upcoming') return !r.isPast;
      if (f === 'open') return r.status === 'open' || r.status === 'full';
      if (f === 'past') return r.isPast;
      return true;
    });
    // upcoming first (soonest), past last (most recent)
    return [...list].sort((a, b) => {
      const ta = a.date?.getTime() ?? Infinity;
      const tb = b.date?.getTime() ?? Infinity;
      return f === 'past' ? tb - ta : ta - tb;
    });
  });

  // ---------- headline numbers ----------
  registrations = computed(() => this.rows().reduce((n, r) => n + r.registered, 0));
  checkedIn = computed(() => this.rows().reduce((n, r) => n + r.checkedIn, 0));
  cancelled = computed(() => this.rows().reduce((n, r) => n + r.cancelled, 0));
  notCheckedIn = computed(() => Math.max(this.registrations() - this.checkedIn(), 0));
  checkedInPct = computed(() =>
    this.registrations() ? Math.round((this.checkedIn() / this.registrations()) * 100) : 0);
  openCount = computed(() => this.filterCounts().open);

  // ---------- needs attention ----------
  attention = computed<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const rows = this.rows();

    const toFinalize = rows.filter((r) => r.needsFinalize);
    if (toFinalize.length) {
      items.push({
        tone: 'bad',
        text: `${toFinalize.length} past event${toFinalize.length > 1 ? 's need' : ' needs'} finalizing`,
        cta: 'Finalize',
        action: 'finalize',
      });
    }

    rows.filter((r) => r.status === 'open' && r.capacity > 0 && r.fill >= 90).forEach((r) =>
      items.push({
        tone: 'warn',
        text: `${r.name} is almost full (${r.registered}/${r.capacity})`,
        cta: 'Attendees',
        link: ['/admin/attendees', r.id],
      }));

    rows.filter((r) => r.status === 'open' && r.registered === 0).forEach((r) =>
      items.push({
        tone: 'info',
        text: `${r.name} is open but has no registrations yet`,
        cta: 'Manage',
        link: '/admin/events',
      }));

    return items;
  });

  // ---------- registrations bar chart ----------
  private yMax = computed(() => {
    const max = Math.max(0, ...this.rows().map((r) => r.registered));
    return Math.max(4, Math.ceil(max / 4) * 4); // multiple of 4 => clean integer ticks
  });

  yTicks = computed(() => {
    const max = this.yMax();
    return [0, 1, 2, 3, 4].map((i) => ({
      value: (max / 4) * i,
      y: Y_BASE - ((Y_BASE - Y_TOP) / 4) * i,
    }));
  });

  chartBars = computed(() => {
    const top = [...this.rows()]
      .sort((a, b) => b.registered - a.registered)
      .slice(0, 8);
    const max = this.yMax();
    const slot = (X1 - X0) / Math.max(top.length, 1);
    const bw = Math.min(26, slot * 0.34);
    const h = (v: number) => (v / max) * (Y_BASE - Y_TOP);
    return top.map((r, i) => {
      const cx = X0 + slot * i + slot / 2;
      return {
        id: r.id,
        full: r.name,
        label: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
        cx,
        bw,
        regX: cx - bw - 1,
        regY: Y_BASE - h(r.registered),
        regH: h(r.registered),
        chkX: cx + 1,
        chkY: Y_BASE - h(r.checkedIn),
        chkH: h(r.checkedIn),
        registered: r.registered,
        checkedIn: r.checkedIn,
      };
    });
  });

  hiddenEvents = computed(() => Math.max(this.rows().length - 8, 0));

  // ---------- donut ----------
  donutIn = computed(() => {
    const total = this.registrations();
    return total ? +((this.checkedIn() / total) * CIRC).toFixed(1) : 0;
  });
  donutOut = computed(() => {
    const total = this.registrations();
    return total ? +((this.notCheckedIn() / total) * CIRC).toFixed(1) : 0;
  });

  // ---------- featured event: soonest open one ----------
  featured = computed(() => {
    const open = this.rows().filter((r) => r.status === 'open' || r.status === 'full');
    open.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
    return open[0] ?? null;
  });

  // ---------- actions ----------
  async finalizePast() {
    const alert = await this.alertCtrl.create({
      header: 'Finalize past events?',
      message: 'This updates registration records for all past events. It can\'t be undone from here.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Finalize', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.finalizing.set(true);
    try {
      const count = await this.admin.finalizePastEvents();
      await this.toast(count === 0 ? 'Nothing to finalize.' : `Finalized ${count} registration(s).`);
      await this.load();
    } catch (e) {
      await this.toast((e as Error).message);
    } finally {
      this.finalizing.set(false);
    }
  }

  exportCsv() {
    const header = ['Event', 'Date', 'Status', 'Capacity', 'Registered', 'Checked in', 'Cancelled'];
    const lines = this.rows().map((r) => [
      r.name,
      r.date ? r.date.toISOString().slice(0, 10) : '',
      r.statusLabel,
      r.capacity || '',
      r.registered,
      r.checkedIn,
      r.cancelled,
    ]);
    const csv = [header, ...lines]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}