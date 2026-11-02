import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './scanner.page.html',
  styleUrl: './scanner.page.scss',
})
export class ScannerPage {
  store = inject(DemoStore);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  ev = computed(() => this.store.event(this.id));
  private last = signal<string>('');
  result = computed(() => {
    this.store.attendees(); // re-evaluate after check-in
    return this.last() ? this.store.lookup(this.id, this.last()) : null;
  });

  check(value: string) { this.last.set(value.trim()); }
  confirm(ticketId: string) {
    this.store.checkIn(this.id, ticketId);
    this.store.toast('Check-in confirmed.');
  }
}
