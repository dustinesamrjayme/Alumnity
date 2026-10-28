import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import QRCode from 'qrcode';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" routerLink="/tabs/tickets">← My tickets</a>
        @if (t(); as t) {
          @if (ev(); as e) {
            <div class="ticket">
              <div class="ticket-head">
                <div class="row">
                  <img class="brand-logo" src="assets/plv-alumni-logo.svg" alt="PLV Alumni Events logo" />
                  <div>
                    <div class="eyebrow">PLV Alumni Events</div>
                    <h2>{{ e.title }}</h2>
                    <p class="small">{{ t.name }} · {{ store.dateLabel(e) }}, {{ store.timeLabel(e) }}</p>
                  </div>
                </div>
              </div>
              <div class="ticket-body">
                <div class="center"><span class="pill" [class.green]="!t.checkedIn" [class.yellow]="t.checkedIn">{{ t.checkedIn ? 'Already used' : 'Valid ticket' }}</span></div>
                <div class="perforation"></div>
                <div class="qr">@if (qr()) { <img [src]="qr()" alt="Ticket QR code" /> }</div>
                <div class="center small" style="margin-top:12px">{{ t.ticketId }}</div>
                <div class="notice" style="text-align:center">{{ e.fee > 0 ? 'Pay ' + store.feeLabel(e) + ' at the event' : 'Free admission' }}</div>
                <div class="ticket-info"><span>Venue</span><strong>{{ e.venue }}</strong></div>
                <div class="ticket-info"><span>Check-in status</span><strong>{{ t.checkedIn ? 'Checked in' : 'Not checked-in' }}</strong></div>
              </div>
            </div>
            <button class="btn success full mt2" (click)="download(t.ticketId)">Download PNG</button>
          }
        } @else {
          <div class="empty">We couldn't find that ticket.</div>
        }
      </div>
    </ion-content>
  `,
})
export class TicketPage {
  store = inject(DemoStore);
  private ticketId = inject(ActivatedRoute).snapshot.paramMap.get('ticketId');
  t = computed(() => this.store.ticket(this.ticketId));
  ev = computed(() => { const t = this.t(); return t ? this.store.event(t.eventId) : undefined; });
  qr = signal('');

  constructor() {
    if (this.ticketId) {
      QRCode.toDataURL(this.ticketId, { width: 400, margin: 1, color: { dark: '#14284B', light: '#FFFFFF' } })
        .then((url) => this.qr.set(url))
        .catch(() => this.store.toast('Could not generate the QR code.'));
    }
  }

  download(id: string) {
    const url = this.qr();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.png`;
    a.click();
  }
}
