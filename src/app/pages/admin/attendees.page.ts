import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-attendees',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" routerLink="/admin/checkin">← Back to scan</a>
        @if (ev(); as e) {
          <div class="eyebrow">{{ e.title }}</div>
          <h1 class="title">Check-in desk</h1>
          <p class="sub">{{ store.dateLabel(e) }} · {{ e.venue }}</p>
          <div class="stat-grid">
            <div class="stat"><span>Checked in</span><strong>{{ e.checkedIn }}</strong><small class="small">of {{ e.registered }} registered</small></div>
            <div class="stat"><span>Amount due</span><strong>{{ store.feeLabel(e) }}</strong><small class="small">{{ e.fee > 0 ? 'Pay at event' : 'No payment' }}</small></div>
          </div>
          <div class="row" style="margin-top:13px">
            <a class="btn primary grow" [routerLink]="['/admin/checkin', e.id, 'scan']">▦ Scan QR</a>
            <a class="btn soft grow" routerLink="/admin/checkin/sync">Sync</a>
          </div>
          <div class="search"><input placeholder="Search attendee" (input)="q.set($any($event.target).value)" /></div>
          <div class="section"><h2>Attendees</h2><span class="small">{{ list().length }} shown</span></div>
          @for (a of list(); track a.ticketId) {
            <div class="card">
              <div class="row between">
                <div><h3 style="font:800 15px Manrope;margin:0 0 5px">{{ a.name }}</h3><p class="small">{{ a.email }}</p></div>
                <span class="pill" [class.green]="a.checkedIn" [class.yellow]="!a.checkedIn">{{ a.checkedIn ? 'Checked-in' : 'Not checked-in' }}</span>
              </div>
              <div class="event-bottom">
                <span class="small">{{ a.checkedIn ? 'Payment confirmed' : (e.fee > 0 ? store.feeLabel(e) + ' · amount due' : 'Free entry') }}</span>
                @if (a.checkedIn) { <button class="btn outline" disabled>Checked-in</button> }
                @else { <button class="btn primary" (click)="checkIn(e.id, a.ticketId)">Check in</button> }
              </div>
            </div>
          } @empty {
            <div class="empty">No attendees found.</div>
          }
        } @else {
          <div class="empty">We couldn't find that event.</div>
        }
      </div>
    </ion-content>
  `,
})
export class AttendeesPage {
  store = inject(DemoStore);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  q = signal('');
  ev = computed(() => this.store.event(this.id));
  list = computed(() => {
    const q = this.q().toLowerCase().trim();
    return (this.store.attendees()[this.id] ?? []).filter((a) => (a.name + a.email + a.ticketId).toLowerCase().includes(q));
  });
  checkIn(eventId: string, ticketId: string) {
    this.store.checkIn(eventId, ticketId);
    this.store.toast(this.store.online() ? 'Attendee checked in.' : 'Checked in offline. It will sync when you reconnect.');
  }
}
