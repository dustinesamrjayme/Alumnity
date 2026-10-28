import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-sync-status',
  standalone: true,
  imports: [IonContent, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" (click)="location.back()">← Back</a>
        <div class="eyebrow">Online / offline</div>
        <h1 class="title">Sync status</h1>
        <p class="sub">Prepare your device before the event. Pending check-ins can sync when you reconnect.</p>
        <div class="card">
          <div class="row between">
            <div><h3 class="h3">Connection</h3><p class="small">Current network status</p></div>
            <span class="pill" [class.green]="store.online()" [class.yellow]="!store.online()">{{ store.online() ? 'Online' : 'Offline' }} · {{ store.pending() }} pending</span>
          </div>
          <div class="perforation"></div>
          <div class="row between">
            <div><h3 class="h3">Pending check-ins</h3><p class="small">Waiting to sync</p></div>
            <strong style="font:800 25px Manrope">{{ store.pending() }}</strong>
          </div>
          <div class="perforation"></div>
          <div class="row between">
            <div><h3 class="h3">Last synced</h3><p class="small">{{ store.lastSynced() }}</p></div>
            <span class="pill">Demo</span>
          </div>
        </div>
        <div class="section"><h2>Offline preparation</h2></div>
        <div class="card">
          <div class="row"><span class="mini">↓</span><div class="grow"><h3 class="h3">Download attendee list</h3><p class="small">{{ store.listCached() ? 'Cached on this device.' : 'Cache the list on this device.' }}</p></div></div>
          <button class="btn outline full mt2" (click)="cache()">{{ store.listCached() ? 'Refresh list' : 'Download list' }}</button>
        </div>
        <div class="card">
          <div class="row"><span class="mini green">↻</span><div class="grow"><h3 class="h3">Sync pending records</h3><p class="small">Upload queued check-ins and payments.</p></div></div>
          <button class="btn primary full mt2" (click)="sync()">Sync now</button>
        </div>
        <div class="notice">This prototype keeps data on this device only. Real offline sync needs a backend and a sync strategy.</div>
      </div>
    </ion-content>
  `,
})
export class SyncStatusPage {
  store = inject(DemoStore);
  location = inject(Location);

  cache() {
    this.store.cacheList();
    this.store.toast('Attendee list cached locally (demo).');
  }
  sync() {
    this.store.toast(this.store.syncNow() ? 'Sync simulated. A backend is required for real sync.' : "You're offline. Reconnect to sync.");
  }
}
