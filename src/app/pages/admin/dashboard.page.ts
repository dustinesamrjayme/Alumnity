import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
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
          <div class="stat"><span>Pending sync</span><strong>{{ store.pending() }}</strong><small class="small">On this device</small></div>
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
  registrations = computed(() => this.store.events().reduce((n, e) => n + e.registered, 0));
  checkedIn = computed(() => this.store.events().reduce((n, e) => n + e.checkedIn, 0));
  featured = computed(() => this.store.openEvents()[0]);
}
