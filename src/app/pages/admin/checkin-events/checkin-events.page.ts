import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-checkin-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './checkin-events.page.html',
  styleUrl: './checkin-events.page.scss',
})
export class CheckinEventsPage {
  store = inject(DemoStore);
  q = signal('');
  list = computed(() => this.store.events().filter((e) => e.title.toLowerCase().includes(this.q().toLowerCase().trim())));
}
