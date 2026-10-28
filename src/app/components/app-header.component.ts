import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { DemoStore } from '../core/demo-store.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, RouterLink],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="plv-top">
        <div class="top">
          <a class="brand" routerLink="/tabs/events">
            <img class="brand-logo" src="assets/plv-alumni-logo.svg" alt="PLV Alumni Events logo" />
            <span>PLV<br /><span class="brand-sub">Alumni Events</span></span>
          </a>
          <a class="avatar" routerLink="/tabs/profile" aria-label="Profile">{{ store.initials() }}</a>
        </div>
      </ion-toolbar>
      <div class="connection">
        ●
        <span class="pill" [class.green]="store.online()" [class.yellow]="!store.online()">
          {{ store.online() ? 'Online' : 'Offline' }} · {{ store.pending() }} pending
        </span>
        <span class="grow"></span>
        <a class="link" routerLink="/admin/checkin/sync">Sync</a>
      </div>
    </ion-header>
  `,
})
export class AppHeaderComponent {
  store = inject(DemoStore);
}
