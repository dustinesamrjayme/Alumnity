import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-checkin-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="eyebrow">Volunteer / admin</div>
        <h1 class="title">Scan</h1>
        <p class="sub">Choose an event, then scan the attendee's ticket or check in manually.</p>
        <div class="search"><input placeholder="Search events" (input)="q.set($any($event.target).value)" /></div>
        @for (e of list(); track e.id; let i = $index) {
          <div class="card">
            <div class="row">
              <div class="mini" [class.green]="e.theme === 'green'">PLV</div>
              <div class="grow">
                <h2 class="event-title" style="font-size:17px">{{ e.title }}</h2>
                <p class="small">{{ store.dateLabel(e) }} · {{ e.registered }} registered</p>
              </div>
            </div>
            <a class="btn full mt2" [class.primary]="i === 0" [class.outline]="i !== 0" [routerLink]="['/admin/checkin', e.id]">Open check-in desk</a>
          </div>
        } @empty {
          <div class="empty">No events match your search.</div>
        }
      </div>
    </ion-content>
  `,
})
export class CheckinEventsPage {
  store = inject(DemoStore);
  q = signal('');
  list = computed(() => this.store.events().filter((e) => e.title.toLowerCase().includes(this.q().toLowerCase().trim())));
}
