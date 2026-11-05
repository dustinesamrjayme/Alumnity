import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

// Chart geometry (matches the PLV admin mockup: viewBox 620x230)
const X0 = 40, X1 = 580, Y_TOP = 30, Y_BASE = 190;
const R = 52;
const CIRC = 2 * Math.PI * R; // ≈ 326.7

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  store = inject(DemoStore);
  circ = CIRC;

  registrations = computed(() => this.store.events().reduce((n, e) => n + e.registered, 0));
  checkedIn = computed(() => this.store.events().reduce((n, e) => n + e.checkedIn, 0));
  notCheckedIn = computed(() => Math.max(this.registrations() - this.checkedIn(), 0));
  checkedInPct = computed(() => {
    const total = this.registrations();
    return total ? Math.round((this.checkedIn() / total) * 100) : 0;
  });
  featured = computed(() => this.store.openEvents()[0]);

  // ---- Table rows with status pills ----
  rows = computed(() => {
    const openIds = new Set(this.store.openEvents().map((e) => e.id));
    return this.store.events().map((e) => {
      const full = e.registered >= e.capacity;
      const open = openIds.has(e.id);
      return {
        id: e.id,
        title: e.title,
        registered: e.registered,
        capacity: e.capacity,
        fill: this.store.fillPercent(e),
        // pg = green, pr = red, pt = tint, pf = outlined (same names as the mockup)
        ...(full ? { status: 'Full', pill: 'pr' } : open ? { status: 'Open', pill: 'pt' } : { status: 'Closed', pill: 'pf' }),
      };
    });
  });

  // ---- Donut ----
  donutIn = computed(() => {
    const total = this.registrations();
    return total ? +((this.checkedIn() / total) * CIRC).toFixed(1) : 0;
  });
  donutOut = computed(() => {
    const total = this.registrations();
    return total ? +((this.notCheckedIn() / total) * CIRC).toFixed(1) : 0;
  });

  // ---- Line / area chart ----
  private yMax = computed(() => {
    const max = Math.max(0, ...this.store.events().map((e) => e.registered));
    if (max <= 4) return 4;
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / step) * step; // round up to a clean number
  });

  yTicks = computed(() => {
    const max = this.yMax();
    return [0, 1, 2, 3, 4].map((i) => ({
      value: Math.round((max / 4) * i),
      y: Y_BASE - ((Y_BASE - Y_TOP) / 4) * i,
    }));
  });

  series = computed(() => {
    const events = this.store.events();
    const max = this.yMax();
    const n = events.length;
    return events.map((e, i) => ({
      id: e.id,
      label: e.title.length > 10 ? e.title.slice(0, 9) + '…' : e.title,
      x: n === 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) / (n - 1)) * i,
      y: +(Y_BASE - (e.registered / max) * (Y_BASE - Y_TOP)).toFixed(1),
    }));
  });

  linePoints = computed(() => this.series().map((p) => `${p.x},${p.y}`).join(' '));

  areaPath = computed(() => {
    const s = this.series();
    if (!s.length) return '';
    const pts = s.map((p) => `${p.x} ${p.y}`).join(' L');
    return `M${pts} L${s[s.length - 1].x} ${Y_BASE} L${s[0].x} ${Y_BASE}Z`;
  });
}