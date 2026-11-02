import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './event-details.page.html',
  styleUrl: './event-details.page.scss',
})
export class EventDetailsPage {
  store = inject(DemoStore);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  ev = computed(() => this.store.event(this.id));
  existing = computed(() => this.store.tickets().find((t) => t.eventId === this.id));
}
