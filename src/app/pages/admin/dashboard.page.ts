import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

// Chart geometry (matches the PLV admin mockup: viewBox 620x230)
const X0 = 40, X1 = 580, Y_TOP = 30, Y_BASE = 190;
const R = 52;
const CIRC = 2 * Math.PI * R; // ≈ 326.7

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  styleUrl: './dashboard.page.scss',
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="eyebrow">Organizer workspace</div>
        <h1 class="title">Dashboard</h1>
        <p class="sub">A clear overview of alumni events and entry activity.</p>

        <div class="stat-grid">
          <div class="stat"><span>Registrations</span><strong>{{ registrations() }}</strong><small class="small">Across events</small></div>
          <div class="stat"><span>Checked-in</span><strong>{{ checkedIn() }}</strong><small class="small">All events</small></div>
          <div class="stat"><span>Open events</span><strong>{{ store.openEvents().length }}</strong><small class="small">Registration live</small></div>
          <div class="stat"><span>Cancelled</span><strong>{{ store.pending() }}</strong><small class="small">All Events</small></div>
        </div>

        <!-- Registrations per event: line + area chart -->
        <div class="card chart">
          <h2>Registrations by event</h2>
          <svg viewBox="0 0 620 230" role="img"
               [attr.aria-label]="'Registrations across ' + series().length + ' events, total ' + registrations()">
            <g class="gl">
              @for (t of yTicks(); track t.value) {
                <line [attr.x1]="40" [attr.x2]="600" [attr.y1]="t.y" [attr.y2]="t.y" />
              }
            </g>
            <g class="ax" text-anchor="end">
              @for (t of yTicks(); track t.value) {
                <text x="32" [attr.y]="t.y + 4">{{ t.value }}</text>
              }
            </g>
            @if (series().length) {
              <path class="ar" [attr.d]="areaPath()" />
              <polyline class="ln" [attr.points]="linePoints()" />
              <g>
                @for (p of series(); track p.id) {
                  <circle class="pt" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
                }
              </g>
              <g class="ax" text-anchor="middle">
                @for (p of series(); track p.id) {
                  <text [attr.x]="p.x" y="212">{{ p.label }}</text>
                }
              </g>
            }
          </svg>
          <div class="up">{{ registrations() }} total registrations</div>
        </div>

        <!-- Check-in status: donut -->
        <div class="card chart">
          <h2>Check-in status</h2>
          <div class="dn">
            <svg viewBox="0 0 140 140" role="img"
                 [attr.aria-label]="checkedIn() + ' checked in, ' + notCheckedIn() + ' not checked in'">
              <g fill="none" stroke-width="18" transform="rotate(-90 70 70)">
                <circle cx="70" cy="70" r="52" class="track" />
                <circle cx="70" cy="70" r="52" class="seg-in"
                        [attr.stroke-dasharray]="donutIn() + ' ' + circ" />
                @if (notCheckedIn() > 0) {
                  <circle cx="70" cy="70" r="52" class="seg-out"
                          [attr.stroke-dasharray]="donutOut() + ' ' + circ"
                          [attr.stroke-dashoffset]="-donutIn()" />
                }
              </g>
              <text class="num" x="70" y="72" text-anchor="middle">{{ checkedInPct() }}%</text>
              <text class="ax" x="70" y="90" text-anchor="middle">checked in</text>
            </svg>
            <div class="legend">
              <div><i class="dot in"></i>{{ checkedIn() }} checked in</div>
              <div><i class="dot out"></i>{{ notCheckedIn() }} not checked in</div>
            </div>
          </div>
        </div>

        <!-- Capacity fill per event: horizontal bars -->
        <div class="card chart">
          <h2>Capacity filled</h2>
          <div class="bars">
            @for (e of store.events(); track e.id) {
              <div class="br">
                <span class="br-name">{{ e.title }}</span>
                <div class="bar"><i [style.width.%]="store.fillPercent(e)"></i></div>
                <b>{{ e.registered }}</b>
              </div>
            }
          </div>
        </div>

        <!-- Upcoming events table with status pills -->
        <div class="card chart">
          <h2>Upcoming events</h2>
          <div class="tablewrap">
            <table>
              <thead>
                <tr><th>Event</th><th>Registered</th><th>Status</th></tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr>
                    <td><b>{{ r.title }}</b></td>
                    <td>
                      {{ r.registered }} / {{ r.capacity }}
                      <div class="bar"><i [style.width.%]="r.fill"></i></div>
                    </td>
                    <td><span [class]="'pill ' + r.pill">{{ r.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="section"><h2>Quick actions</h2></div>
        <a class="btn primary full" routerLink="/admin/events/new">＋ Create event</a>
        <a class="btn soft full mt" routerLink="/admin/checkin/sync">Sync status</a>

        @if (featured(); as e) {
          <div class="section"><h2>{{ e.title }}</h2><a class="link" routerLink="/admin/events">Manage</a></div>
          <div class="card">
            <div class="row between"><span class="small">Registration progress</span><strong>{{ e.registered }} / {{ e.capacity }}</strong></div>
            <div class="progress" style="margin:10px 0 15px"><span [style.width.%]="store.fillPercent(e)"></span></div>
            <a class="btn outline full" [routerLink]="['/admin/checkin', e.id]">View attendees</a>
          </div>
        }
        <a class="btn outline full mt" routerLink="/tabs/events">Switch to attendee view</a>
      </div>
    </ion-content>
  `,
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