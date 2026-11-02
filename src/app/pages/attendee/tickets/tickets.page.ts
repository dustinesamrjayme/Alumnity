import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './tickets.page.html',
  styleUrl: './tickets.page.scss',
})
export class TicketsPage {
  store = inject(DemoStore);
  rows = computed(() =>
    this.store.tickets()
      .map((t) => ({ t, e: this.store.event(t.eventId) }))
      .filter((r): r is { t: typeof r.t; e: NonNullable<typeof r.e> } => !!r.e),
  );
}
