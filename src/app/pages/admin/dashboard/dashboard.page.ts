// dashboard.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, ToastController } from '@ionic/angular/standalone';
import {
  AdminService, AlumniSummary, BatchPoint, DepartmentPoint, RegistrationTrendPoint,
} from '../../../core/repositories/admin.service';
import { EventsService } from '../../../core/repositories/events.service';
import { EventDashboardStats, EventItem } from '../../../core/models';
import { DepartmentUserStats } from '../../../core/department-user-stats';
import { TotalAlumniGrowthPoint } from '../../../core/total-alumni-growth-point';

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
const REGISTERED_INCLUDES_CANCELLED = false;

// Same default grace period as finalize_past_events(p_grace_hours) in the database.
const GRACE_HOURS = 12;

// Horizontal-bar rows used by the warehouse breakdowns (batch, department)
interface BarRow { label: string; registrations: number; checkedIn: number; width: number; rate: number; }
function toBarRows(items: { label: string; registrations: number; checkedIn: number }[]): BarRow[] {
  const max = Math.max(1, ...items.map((i) => i.registrations));
  return items.map((i) => ({
    ...i,
    width: (i.registrations / max) * 100,
    rate: i.registrations ? Math.round((i.checkedIn / i.registrations) * 100) : 0,
  }));
}

// Pie slice colours (department breakdown)
const PIE_COLORS = ['#2457a6', '#1f7a58', '#e8c15a', '#c94a4a', '#7a5fb0'];

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
  userDeptStats = signal<DepartmentUserStats[]>([]);
  alumniGrowth = signal<TotalAlumniGrowthPoint[]>([]);

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
    void this.loadAnalytics(); // warehouse section loads on its own; a failure here never blanks the page
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

    // Bar Chart: Alumni by Department
   // Bar Chart: Alumni by Department
  alumniDeptBars = computed(() => {
    const raw = this.userDeptStats();
    const max = Math.max(1, ...raw.map(s => s.alumni_count));
    
    return [...raw]
      .sort((a, b) => b.alumni_count - a.alumni_count)
      .map((s) => {
        // Find the original index to match the pie chart's color assignment
        const originalIndex = raw.findIndex(r => r.department === s.department);
        return {
          label: s.department,
          value: s.alumni_count,
          width: (s.alumni_count / max) * 100,
          total: s.total_users,
          color: PIE_COLORS[originalIndex % PIE_COLORS.length] // <-- Matches the pie chart
        };
      });
  });

    // Pie Chart: Alumni by Department (Matches the line graph)
  userPie = computed(() => {
    // 1. Change filter and total to use alumni_count
    const stats = this.userDeptStats().filter(s => s.alumni_count > 0);
    const total = stats.reduce((n, s) => n + s.alumni_count, 0);
    
    const CX = 70, CY = 70, PR = 62;
    let angle = -Math.PI / 2;
    
    const slices = stats.map((s, i) => {
      // 2. Use alumni_count for the slice fraction
      const frac = s.alumni_count / total;
      const a0 = angle;
      const a1 = angle + frac * 2 * Math.PI;
      angle = a1;
      
      const x0 = CX + PR * Math.cos(a0), y0 = CY + PR * Math.sin(a0);
      const x1 = CX + PR * Math.cos(a1), y1 = CY + PR * Math.sin(a1);
      const full = frac >= 0.9999;
      
      return {
        label: s.department,
        value: s.alumni_count, // 3. Change this to alumni_count
        pct: Math.round(frac * 100),
        fill: PIE_COLORS[i % PIE_COLORS.length],
        path: full ? null
          : `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${PR} ${PR} 0 ${frac > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      };
    });
    return { total, slices };
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

  // ---------- warehouse analytics (reads the analytics schema via admin-only RPCs) ----------
  trend = signal<RegistrationTrendPoint[]>([]);
  byBatch = signal<BatchPoint[]>([]);
  byDept = signal<DepartmentPoint[]>([]);
  analyticsLoading = signal(false);
  analyticsError = signal<string | null>(null);
  refreshingWarehouse = signal(false);

  async loadAnalytics() {
    this.analyticsLoading.set(true);
    this.analyticsError.set(null);
    try {
      const [t, b, d, u, g] = await Promise.all([
        this.admin.analyticsTrend(),
        this.admin.analyticsByBatch(),
        this.admin.analyticsByDepartment(),
        this.admin.userCountsByDepartment(),
        this.admin.totalAlumniGrowth(),

      ]);
      this.trend.set(t);
      this.byBatch.set(b);
      this.byDept.set(d);
      this.userDeptStats.set(u);
      this.alumniGrowth.set(g);
    } catch (e) {
      this.analyticsError.set((e as Error).message || 'Could not load analytics.');
    } finally {
      this.analyticsLoading.set(false);
    }
  }

  /** Refresh button: rebuild the warehouse, then reload the live numbers and the charts. */
  async refreshAll() {
    this.refreshingWarehouse.set(true);
    try {
      await this.admin.refreshAnalytics();
    } catch {
      // A failed rebuild must not block the live view; the charts just keep the last nightly data.
      await this.toast("Couldn't rebuild analytics. Showing the last nightly data.");
    } finally {
      this.refreshingWarehouse.set(false);
    }
    await this.load();
  }

  // Monthly trend: last 12 months that have data
  private trendWindow = computed(() => this.trend().slice(-12));

  private trendMax = computed(() => {
    const max = Math.max(0, ...this.trendWindow().map((p) => p.registrations));
    return Math.max(4, Math.ceil(max / 4) * 4);
  });

  trendTicks = computed(() => {
    const max = this.trendMax();
    return [0, 1, 2, 3, 4].map((i) => ({
      value: (max / 4) * i,
      y: Y_BASE - ((Y_BASE - Y_TOP) / 4) * i,
    }));
  });

  trendBars = computed(() => {
    const pts = this.trendWindow();
    const max = this.trendMax();
    const slot = (X1 - X0) / Math.max(pts.length, 1);
    const bw = Math.min(28, slot * 0.5);
    return pts.map((p, i) => {
      const cx = X0 + slot * i + slot / 2;
      const h = (p.registrations / max) * (Y_BASE - Y_TOP);
      const d = new Date(p.year, p.month - 1, 1);
      const revenue = +p.revenue || 0;
      return {
        key: p.year * 100 + p.month,
        label: d.toLocaleString('en', { month: 'short' }) + " '" + String(p.year).slice(2),
        full: d.toLocaleString('en', { month: 'long', year: 'numeric' }),
        cx, bw, x: cx - bw / 2, y: Y_BASE - h, h,
        registrations: p.registrations,
        revenueText: '₱' + revenue.toLocaleString('en-PH', { maximumFractionDigits: 0 }),
      };
    });
  });

  totalRevenue = computed(() => this.trend().reduce((n, p) => n + (+p.revenue || 0), 0));
  revenueLabel = computed(() => '₱' + this.totalRevenue().toLocaleString('en-PH', { maximumFractionDigits: 0 }));
  warehouseRegistrations = computed(() => this.trend().reduce((n, p) => n + p.registrations, 0));

  // Breakdown by graduation batch (newest first, top 8)
  batchRows = computed<BarRow[]>(() =>
    toBarRows(
      [...this.byBatch()]
        .sort((a, b) => b.batch - a.batch)
        .slice(0, 8)
        .map((b) => ({ label: String(b.batch), registrations: b.registrations, checkedIn: b.checked_in })),
    ));

  // Breakdown by department (programs rolled up)
  deptRows = computed<BarRow[]>(() => {
    const m = new Map<string, { registrations: number; checkedIn: number }>();
    for (const r of this.byDept()) {
      const cur = m.get(r.department) ?? { registrations: 0, checkedIn: 0 };
      cur.registrations += r.registrations;
      cur.checkedIn += r.checked_in;
      m.set(r.department, cur);
    }
    return toBarRows(
      [...m.entries()]
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.registrations - a.registrations),
    );
  });

  // Department pie: one slice per department, sized by registrations
  deptPie = computed(() => {
    const rows = this.deptRows().filter((r) => r.registrations > 0);
    const total = rows.reduce((n, r) => n + r.registrations, 0);
    const CX = 70, CY = 70, PR = 62;
    let angle = -Math.PI / 2;
    const slices = rows.map((r, i) => {
      const frac = r.registrations / total;
      const a0 = angle;
      const a1 = angle + frac * 2 * Math.PI;
      angle = a1;
      const x0 = CX + PR * Math.cos(a0), y0 = CY + PR * Math.sin(a0);
      const x1 = CX + PR * Math.cos(a1), y1 = CY + PR * Math.sin(a1);
      const full = frac >= 0.9999; // a single department can't be drawn as an arc
      return {
        label: r.label,
        registrations: r.registrations,
        rate: r.rate,
        pct: Math.round(frac * 100),
        fill: PIE_COLORS[i % PIE_COLORS.length],
        path: full ? null
          : `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${PR} ${PR} 0 ${frac > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      };
    });
    return { total, slices };
  });

  singleLineChart = computed(() => {
    const data = this.alumniGrowth();
    if (!data.length) return null;

    const maxY = Math.max(...data.map(d => d.cumulative_count), 4);
    const X0 = 40, X1 = 580, Y_TOP = 30, Y_BASE = 190;

    const getX = (index: number) => 
      data.length === 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) / (data.length - 1)) * index;

    const getY = (val: number) => Y_BASE - (val / maxY) * (Y_BASE - Y_TOP);

    const points = data.map((d, i) => ({
      x: getX(i),
      y: getY(d.cumulative_count),
      val: d.cumulative_count
    }));

   const path = points.length === 1 
    ? `M ${X0} ${points[0].y} L ${X1} ${points[0].y}` // <-- This draws the flat line!
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const labels = data.map((d, i) => {
      const date = new Date(d.date_str + '-01');
      return {
        x: getX(i),
        text: date.toLocaleString('en', { month: 'short' }) + " '" + String(date.getFullYear()).slice(2)
      };
    });

    const ticks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
      val: Math.round(maxY * pct),
      y: getY(maxY * pct)
    }));

    return { points, path, labels, ticks };
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