import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-past-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" routerLink="/admin/events">← Manage events</a>
        <div class="eyebrow">Archive</div>
        <h1 class="title">Past events</h1>
        <p class="sub">Closed events and attendance summaries.</p>
        @for (e of store.pastEvents; track e.id) {
          <div class="card">
            <div class="row between">
              <div><h2 class="event-title" style="font-size:17px">{{ e.title }}</h2><p class="small">{{ e.dateLabel }} · {{ e.venue }}</p></div>
              <span class="pill">Closed</span>
            </div>
            <p class="small">{{ e.registered }} registered · {{ e.checkedIn }} checked in</p>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class PastEventsPage {
  store = inject(DemoStore);
}
