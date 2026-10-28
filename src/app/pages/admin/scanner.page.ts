import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" [routerLink]="['/admin/checkin', id]">← Check-in desk</a>
        <div class="eyebrow">Volunteer / admin</div>
        <h1 class="title">Scan ticket</h1>
        <p class="sub">Point the camera at the attendee's QR code, or type the ticket code below.</p>
        <section class="scanner-shell">
          <div class="row between"><strong>Scanner</strong>
            <span class="pill" [class.green]="store.online()" [class.yellow]="!store.online()">{{ store.online() ? 'Online' : 'Offline' }} · {{ store.pending() }} pending</span></div>
          <div class="scan-frame">▦</div>
          <p class="small" style="color:#d7e2f3">Camera scanner placeholder</p>
          <button class="btn primary full" (click)="store.toast('Camera scanning is not connected in this prototype.')">Open camera</button>
        </section>
        <div class="section"><h2>Enter ticket code</h2></div>
        <div class="row">
          <input #code class="grow" placeholder="PLV-ALM-2026-00482" (keyup.enter)="check(code.value)" />
          <button class="btn soft" (click)="check(code.value)">Check</button>
        </div>
        @if (result(); as r) {
          @switch (r.state) {
            @case ('valid') {
              <div class="result">
                <strong>✓ Valid ticket</strong>
                <p>{{ r.attendee!.name }}{{ ev() && ev()!.fee > 0 ? ' · Amount due ' + store.feeLabel(ev()!) : '' }}</p>
                <button class="btn full mt" style="background:#fff;color:var(--green)" (click)="confirm(r.attendee!.ticketId)">
                  {{ ev() && ev()!.fee > 0 ? 'Payment collected' : 'Confirm check-in' }}</button>
              </div>
            }
            @case ('used') {
              <div class="result yellow"><strong>Already checked-in</strong><p>{{ r.attendee!.name }} has already entered. Direct them to staff if needed.</p></div>
            }
            @default {
              <div class="result red"><strong>Invalid / cancelled</strong><p>No matching ticket for this event. Ask the attendee to visit the help desk.</p></div>
            }
          }
        }
        <a class="btn outline full mt2" [routerLink]="['/admin/checkin', id]">Manual check-in</a>
      </div>
    </ion-content>
  `,
})
export class ScannerPage {
  store = inject(DemoStore);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  ev = computed(() => this.store.event(this.id));
  private last = signal<string>('');
  result = computed(() => {
    this.store.attendees(); // re-evaluate after check-in
    return this.last() ? this.store.lookup(this.id, this.last()) : null;
  });

  check(value: string) { this.last.set(value.trim()); }
  confirm(ticketId: string) {
    this.store.checkIn(this.id, ticketId);
    this.store.toast('Check-in confirmed.');
  }
}
