import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="eyebrow">Alumni community</div>
        <h1 class="title">Events</h1>
        <p class="sub">{{ store.openEvents().length }} open for registration</p>
        @for (e of store.openEvents(); track e.id) {
          <article class="card event-card">
            <div class="event-cover" [class.green]="e.theme === 'green'" [class.sky]="e.theme === 'sky'">
              <span class="pill" [class.green]="e.theme === 'green'">{{ store.dateLabel(e) }}</span>
            </div>
            <div class="event-content">
              <h2 class="event-title">{{ e.title }}</h2>
              <div class="event-meta">
                <span>⌖ {{ e.venue }}</span>
                <span>{{ store.slotsLeft(e) === 0 ? 'Fully booked' : store.slotsLeft(e) + ' slots left' }}</span>
              </div>
              <div class="event-bottom">
                <span class="price">{{ store.feeLabel(e) }}</span>
                <a class="btn primary" [routerLink]="['/tabs/events', e.id]">View event</a>
              </div>
            </div>
          </article>
        } @empty {
          <div class="empty">No events are open for registration right now.</div>
        }
      </div>
    </ion-content>
  `,
})
export class EventsPage {
  store = inject(DemoStore);
}
