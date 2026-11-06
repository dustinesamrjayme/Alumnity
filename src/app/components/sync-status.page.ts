// sync-status.page.ts
import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../core/repositories/auth.service';
import { CheckInService } from '../core/repositories/checkin.service';
import { OnlineStatusService } from '../core/online-status.service';

@Component({
  selector: 'app-sync-status',
  standalone: true,
  imports: [IonContent],
  templateUrl: './sync-status.page.html',
  styleUrl: './sync-status.page.scss',
})
export class SyncStatusPage {
  location = inject(Location);
  auth = inject(AuthService);
  checkIn = inject(CheckInService);
  net = inject(OnlineStatusService);
  private toastCtrl = inject(ToastController);

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, position: 'bottom' });
    await t.present();
  }

  async sync() {
    if (!this.net.online()) {
      await this.toast("You're offline. Reconnect to sync.");
      return;
    }
    try {
      const results = await this.checkIn.sync();
      await this.toast(
        results.length === 0 ? 'Nothing to sync.' : `Synced ${results.length} check-in(s).`,
      );
    } catch (e) {
      await this.toast(`Sync failed: ${(e as Error).message}`);
    }
  }

  async clearCache() {
    await this.checkIn.clearCachedLists();
    await this.toast('Cached attendee lists cleared.');
  }
}