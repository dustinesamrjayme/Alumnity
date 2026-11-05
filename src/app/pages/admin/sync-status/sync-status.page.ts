import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-sync-status',
  standalone: true,
  imports: [IonContent, AppHeaderComponent],
  templateUrl: './sync-status.page.html',
  styleUrl: './sync-status.page.scss',
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
