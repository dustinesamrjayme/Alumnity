import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gridOutline, ticketOutline, personOutline, albumsOutline, scanOutline } from 'ionicons/icons';

interface TabDef { tab: string; label: string; icon: string; }

const ATTENDEE: TabDef[] = [
  { tab: 'events', label: 'Events', icon: 'grid-outline' },
  { tab: 'tickets', label: 'My Tickets', icon: 'ticket-outline' },
  { tab: 'profile', label: 'Profile', icon: 'person-outline' },
];
const ADMIN: TabDef[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { tab: 'events', label: 'Events', icon: 'albums-outline' },
  { tab: 'checkin', label: 'Check-in', icon: 'scan-outline' },
];

/** One tab shell, two modes: attendee (/tabs) and organizer (/admin), chosen by route data. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
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
  `,
})
export class ShellPage {
  tabs = inject(ActivatedRoute).snapshot.data['kind'] === 'admin' ? ADMIN : ATTENDEE;
  constructor() {
    addIcons({ gridOutline, ticketOutline, personOutline, albumsOutline, scanOutline });
  }
}
