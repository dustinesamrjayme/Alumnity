import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="center">
          <div class="success-icon">✓</div>
          <span class="pill green">Registration confirmed</span>
          <h1 class="title" style="margin-top:18px">You're in!</h1>
          <p class="sub">Your ticket is ready. Show the QR code at the event entrance.</p>
        </div>
        @if (ev(); as e) {
          <div class="card">
            <div class="row between"><span class="small">Event</span><strong>{{ e.title }}</strong></div>
            <div class="perforation"></div>
            <div class="row between"><span class="small">Amount due at venue</span><strong>{{ store.feeLabel(e) }}</strong></div>
          </div>
        }
        <a class="btn primary full" [routerLink]="['/tabs/tickets', ticketId]">View my ticket</a>
        <a class="btn soft full mt" routerLink="/tabs/events">Back to events</a>
      </div>
    </ion-content>
  `,
})
export class SuccessPage {
  store = inject(DemoStore);
  private r = inject(ActivatedRoute).snapshot.paramMap;
  ticketId = this.r.get('ticketId') ?? '';
  ev = computed(() => this.store.event(this.r.get('id')));
}
