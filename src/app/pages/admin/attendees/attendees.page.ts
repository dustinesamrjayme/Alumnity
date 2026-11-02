import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-attendees',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './attendees.page.html',
  styleUrl: './attendees.page.scss',
})
export class AttendeesPage {
  store = inject(DemoStore);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  q = signal('');
  ev = computed(() => this.store.event(this.id));
  list = computed(() => {
    const q = this.q().toLowerCase().trim();
    return (this.store.attendees()[this.id] ?? []).filter((a) => (a.name + a.email + a.ticketId).toLowerCase().includes(q));
  });
  checkIn(eventId: string, ticketId: string) {
    this.store.checkIn(eventId, ticketId);
    this.store.toast(this.store.online() ? 'Attendee checked in.' : 'Checked in offline. It will sync when you reconnect.');
  }
}
