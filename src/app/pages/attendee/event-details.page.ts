import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" routerLink="/tabs/events">← Back to events</a>
        @if (ev(); as e) {
          <div class="event-cover" [class.green]="e.theme === 'green'" [class.sky]="e.theme === 'sky'" style="height:125px;border-radius:18px">
            <span class="pill">{{ store.dateLabel(e) }}</span>
          </div>
          <div class="eyebrow" style="margin-top:18px">{{ e.open ? 'Open for registration' : 'Registration closed' }}</div>
          <h1 class="title">{{ e.title }}</h1>
          <p class="sub">Reconnect with your batchmates and celebrate the stories that bring the PLV community together.</p>
          <div class="card">
            <div class="listrow row"><span class="mini">▦</span><div><h3>{{ store.longDate(e) }}</h3><p>{{ store.timeLabel(e) }} onwards</p></div></div>
            <div class="listrow row"><span class="mini green">⌖</span><div><h3>{{ e.venue }}</h3><p>Pamantasan ng Lungsod ng Valenzuela</p></div></div>
            <div class="listrow row"><span class="mini">₱</span><div>
              <h3>{{ e.fee > 0 ? store.feeLabel(e) + ' per attendee' : 'Free admission' }}</h3>
              <p>{{ e.fee > 0 ? 'Pay at the event · No online payment' : 'No payment needed' }}</p></div></div>
          </div>
          <div class="section"><h2>About the event</h2></div>
          <p class="sub">{{ e.description }}</p>
          <div class="row between">
            <span class="small">{{ store.slotsLeft(e) }} slots remaining</span>
            <span class="small">Capacity: {{ e.capacity }}</span>
          </div>
          <div class="progress" style="margin:8px 0 20px"><span [style.width.%]="store.fillPercent(e)"></span></div>
          @if (existing(); as t) {
            <a class="btn success full" [routerLink]="['/tabs/tickets', t.ticketId]">You're registered · View ticket</a>
          } @else if (!e.open) {
            <button class="btn outline full" disabled>Registration closed</button>
          } @else if (store.slotsLeft(e) === 0) {
            <button class="btn outline full" disabled>Fully booked</button>
          } @else {
            <a class="btn primary full" [routerLink]="['/tabs/events', e.id, 'register']">Register</a>
          }
        } @else {
          <div class="empty">We couldn't find that event.</div>
        }
      </div>
    </ion-content>
  `,
})
export class EventDetailsPage {
  store = inject(DemoStore);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  ev = computed(() => this.store.event(this.id));
  existing = computed(() => this.store.tickets().find((t) => t.eventId === this.id));
}
