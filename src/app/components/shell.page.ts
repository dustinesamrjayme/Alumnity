import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonHeader, IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  gridOutline, ticketOutline, personOutline, albumsOutline,
  listOutline, cloudUploadOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/repositories/auth.service';
import { CheckInService } from '../core/repositories/checkin.service';
import { OnlineStatusService } from '../core/online-status.service';

interface TabDef { tab: string; label: string; icon: string; }

const ATTENDEE: TabDef[] = [
  { tab: 'events', label: 'Events', icon: 'grid-outline' },
  { tab: 'tickets', label: 'My Tickets', icon: 'ticket-outline' },
  { tab: 'profile', label: 'Profile', icon: 'person-outline' },
];
const ADMIN: TabDef[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { tab: 'events', label: 'Events', icon: 'albums-outline' },
  { tab: 'attendees', label: 'Attendees', icon: 'list-outline' },
];
const VOLUNTEER: TabDef[] = [
  { tab: 'events', label: 'Events', icon: 'albums-outline' },
  { tab: 'sync', label: 'Sync', icon: 'cloud-upload-outline' },
  { tab: 'profile', label: 'Profile', icon: 'person-outline' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonHeader, IonToolbar, RouterLink],
  template: `
    <div class="shell-wrapper">
      <ion-header class="ion-no-border">
        <ion-toolbar class="plv-top">
          <div class="top">
            <a class="brand" [routerLink]="homeRoute()">
              <img class="brand-logo" src="assets/logo.jpg" alt="" />
              <span>Alumnity<br /><span class="brand-sub">PLV Alumni Event Management System</span></span>
            </a>
            <a class="avatar" [routerLink]="profileRoute()" aria-label="Profile">{{ initials() }}</a>
          </div>
        </ion-toolbar>
        @if (kind === 'volunteer') {
          <div class="connection">
            ●
            <span class="pill" [class.green]="online()" [class.yellow]="!online()">
              {{ online() ? 'Online' : 'Offline' }} · {{ pending() }} pending
            </span>
            <span class="grow"></span>
            <a class="link" routerLink="/volunteer/sync">Sync</a>
          </div>
        }
      </ion-header>

      <ion-tabs>
        <ion-tab-bar slot="bottom">
          @for (t of tabs; track t.tab) {
            <ion-tab-button [tab]="t.tab">
              <ion-icon [name]="t.icon" />
              <ion-label>{{ t.label }}</ion-label>
            </ion-tab-button>
          }
        </ion-tab-bar>
      </ion-tabs>
    </div>
  `,
  styles: [`
    /* 1. Force the shell component to fill the entire router outlet */
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    /* 2. Flex container to stack header and tabs cleanly */
    .shell-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    /* 3. Ensure header doesn't shrink */
    ion-header {
      flex: none;
      z-index: 10;
    }

    /* 4. Override Ionic's absolute positioning for tabs so they sit BELOW the header */
    ion-tabs {
      position: relative !important;
      flex: 1;
      height: auto !important;
      bottom: 0;
    }
  `]
})
export class ShellPage {
  kind = inject(ActivatedRoute).snapshot.data['kind'] as 'attendee' | 'admin' | 'volunteer';
  auth = inject(AuthService);
  checkIn = inject(CheckInService);
  net = inject(OnlineStatusService);

  tabs = this.kind === 'admin' ? ADMIN : this.kind === 'volunteer' ? VOLUNTEER : ATTENDEE;

  online = this.net.online;
  pending = this.checkIn.pendingCount;

  initials = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return 'AL';
    return ((u.first_name[0] ?? '') + (u.last_name[0] ?? '')).toUpperCase() || 'AL';
  });

  homeRoute = computed(() =>
    this.kind === 'admin' ? '/admin/dashboard'
    : this.kind === 'volunteer' ? '/volunteer/events'
    : '/tabs/events');

  profileRoute = computed(() =>
    this.kind === 'admin' ? '/admin/profile'
    : this.kind === 'volunteer' ? '/volunteer/profile'
    : '/tabs/profile');

  constructor() {
    addIcons({ gridOutline, ticketOutline, personOutline, albumsOutline, listOutline, cloudUploadOutline });
  }
}