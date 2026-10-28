import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="eyebrow">Your entry passes</div>
        <h1 class="title">My tickets</h1>
        <p class="sub">Your registered events and check-in details.</p>
        @for (r of rows(); track r.t.ticketId; let i = $index) {
          <article class="card">
            <div class="row">
              <div class="mini" [class.green]="r.e.theme === 'green'" style="width:58px;height:58px">PLV</div>
              <div class="grow">
                <h2 class="event-title" style="font-size:17px">{{ r.e.title }}</h2>
                <p class="small">{{ r.t.name }} · {{ store.dateLabel(r.e) }}, {{ store.timeLabel(r.e) }}</p>
                @if (r.t.checkedIn) { <span class="pill green">Checked in</span> }
                @else if (r.e.fee > 0) { <span class="pill yellow">Pay {{ store.feeLabel(r.e) }} at event</span> }
                @else { <span class="pill green">Free</span> }
              </div>
            </div>
            <a class="btn full mt2" [class.primary]="i === 0" [class.outline]="i !== 0" [routerLink]="['/tabs/tickets', r.t.ticketId]">View ticket →</a>
          </article>
        } @empty {
          <div class="empty">No tickets yet. Register for an event to get your QR pass.</div>
        }
      </div>
    </ion-content>
  `,
})
export class TicketsPage {
  store = inject(DemoStore);
  rows = computed(() =>
    this.store.tickets()
      .map((t) => ({ t, e: this.store.event(t.eventId) }))
      .filter((r): r is { t: typeof r.t; e: NonNullable<typeof r.e> } => !!r.e),
  );
}
