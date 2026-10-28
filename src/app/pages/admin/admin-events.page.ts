import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="eyebrow">Organizer workspace</div>
        <h1 class="title">Events</h1>
        <p class="sub">Manage event details and registration status.</p>
        <a class="btn primary full" routerLink="/admin/events/new">＋ Create event</a>
        <div class="section"><h2>All events</h2><span class="pill green">{{ store.openEvents().length }} open</span></div>
        @for (e of store.events(); track e.id) {
          <div class="card">
            <div class="row between">
              <h2 class="event-title" style="margin:0 0 6px">{{ e.title }}</h2>
              <span class="pill" [class.green]="e.open">{{ e.open ? 'Open' : 'Closed' }}</span>
            </div>
            <p class="small">{{ store.dateLabel(e) }} · {{ e.venue }} · {{ store.feeLabel(e) }}</p>
            <div class="row mt2">
              <a class="btn outline grow" [routerLink]="['/admin/events', e.id, 'edit']">Edit</a>
              <a class="btn success grow" [routerLink]="['/admin/checkin', e.id]">Attendees</a>
            </div>
            <button class="btn outline full mt" (click)="toggle(e.id, e.open)">{{ e.open ? 'Close registration' : 'Reopen registration' }}</button>
          </div>
        }
        <a class="link" routerLink="/admin/events/past">View past events</a>
      </div>
    </ion-content>
  `,
})
export class AdminEventsPage {
  store = inject(DemoStore);
  toggle(id: string, wasOpen: boolean) {
    this.store.toggleOpen(id);
    this.store.toast(wasOpen ? 'Registration closed.' : 'Registration reopened.');
  }
}
