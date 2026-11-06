// dashboard.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AdminService } from '../../../core/repositories/admin.service';
import { EventsService } from '../../../core/repositories/events.service';
import { EventDashboardStats, EventItem } from '../../../core/models';

const X0 = 40, X1 = 580, Y_TOP = 30, Y_BASE = 190;
const R = 52;
const CIRC = 2 * Math.PI * R;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonContent, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private admin = inject(AdminService);
  private eventsService = inject(EventsService);
  private toastCtrl = inject(ToastController);

  circ = CIRC;
  events = signal<EventItem[]>([]);
  stats = signal<EventDashboardStats[]>([]);
  finalizing = signal(false);
  loading = signal(true);

  registrations = computed(() => this.stats().reduce((n, s) => n + s.registered, 0));
  checkedIn = computed(() => this.stats().reduce((n, s) => n + s.checked_in, 0));
  cancelled = computed(() => this.stats().reduce((n, s) => n + s.cancelled, 0));
  notCheckedIn = computed(() => Math.max(this.registrations() - this.checkedIn(), 0));
  checkedInPct = computed(() =>
    this.registrations() ? Math.round((this.checkedIn() / this.registrations()) * 100) : 0);
  openCount = computed(() => this.events().filter((e) => e.status === 'listed').length);

  constructor() { void this.load(); }

  private async load() {
    const [evs, sts] = await Promise.all([
      this.eventsService.listAll(),
      this.admin.dashboard(),
    ]);
    this.events.set(evs);
    this.stats.set(sts);
    this.loading.set(false);
  }

  barRows = computed(() => this.events().map((e) => {
    const registered = this.statFor(e.id)?.registered ?? 0;
    const capacity = e.capacity ?? 0;
    const fill = capacity > 0 ? Math.min(100, (registered / capacity) * 100) : 0;
    return { id: e.id, name: e.name, registered, capacity, fill };
  }));

  tableRows = computed(() => this.events().map((e) => {
    const s = this.statFor(e.id);
    const registered = s?.registered ?? 0;
    const capacity = e.capacity ?? 0;
    const fill = capacity > 0 ? Math.min(100, (registered / capacity) * 100) : 0;
    const full = capacity > 0 && registered >= capacity;
    const open = e.status === 'listed';
    return {
      id: e.id, name: e.name, registered, capacity, fill,
      status: full ? 'Full' : open ? 'Open' : 'Closed',
      pill: full ? 'pr' : open ? 'pt' : 'pf',
    };
  }));

  private yMax = computed(() => {
    const max = Math.max(0, ...this.stats().map((s) => s.registered));
    if (max <= 4) return 4;
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / step) * step;
  });

  yTicks = computed(() => {
    const max = this.yMax();
    return [0, 1, 2, 3, 4].map((i) => ({
      value: Math.round((max / 4) * i),
      y: Y_BASE - ((Y_BASE - Y_TOP) / 4) * i,
    }));
  });

  series = computed(() => {
    const evs = this.events();
    const max = this.yMax();
    const n = evs.length;
    return evs.map((e, i) => ({
      id: e.id,
      label: e.name.length > 10 ? e.name.slice(0, 9) + '…' : e.name,
      x: n === 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) / (n - 1)) * i,
      y: +(Y_BASE - ((this.statFor(e.id)?.registered ?? 0) / max) * (Y_BASE - Y_TOP)).toFixed(1),
    }));
  });

  linePoints = computed(() => this.series().map((p) => `${p.x},${p.y}`).join(' '));

  areaPath = computed(() => {
    const s = this.series();
    if (!s.length) return '';
    const pts = s.map((p) => `${p.x} ${p.y}`).join(' L');
    return `M${pts} L${s[s.length - 1].x} ${Y_BASE} L${s[0].x} ${Y_BASE}Z`;
  });

  donutIn = computed(() => {
    const total = this.registrations();
    return total ? +((this.checkedIn() / total) * CIRC).toFixed(1) : 0;
  });
  donutOut = computed(() => {
    const total = this.registrations();
    return total ? +((this.notCheckedIn() / total) * CIRC).toFixed(1) : 0;
  });

  featured = computed(() => this.events().find((e) => e.status === 'listed') ?? null);

  async finalizePast() {
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

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }


  statFor(eventId: number) {              // remove `private`
  return this.stats().find((s) => s.event_id === eventId);
}

  fillPercentFor(eventId: number): number {
    const ev = this.events().find((e) => e.id === eventId);
    if (!ev || !ev.capacity) return 0;
    const registered = this.statFor(eventId)?.registered ?? 0;
    return Math.min(100, Math.round((registered / ev.capacity) * 100));
  }
}

