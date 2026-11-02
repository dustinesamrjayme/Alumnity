import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './admin-events.page.html',
  styleUrl: './admin-events.page.scss',
})
export class AdminEventsPage {
  store = inject(DemoStore);
  toggle(id: string, wasOpen: boolean) {
    this.store.toggleOpen(id);
    this.store.toast(wasOpen ? 'Registration closed.' : 'Registration reopened.');
  }
}
