// admin-events.page.ts
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { EventItem } from '../../../core/models';
import { DateLabelPipe, FeeLabelPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, FeeLabelPipe],
  templateUrl: './admin-events.page.html',
  styleUrl: './admin-events.page.scss',
})
export class AdminEventsPage {
  private eventsService = inject(EventsService);
  private toastCtrl = inject(ToastController);
  events = signal<EventItem[]>([]);

  constructor() { void this.load(); }
  private async load() { this.events.set(await this.eventsService.listAll()); }

  async toggle(e: EventItem) {
    try {
      await (e.status === 'listed'
        ? this.eventsService.close(e.id)
        : this.eventsService.reopen(e.id));
      await this.toast(e.status === 'listed' ? 'Registration closed.' : 'Registration reopened.');
      await this.load();
    } catch (err) { await this.toast((err as Error).message); }
  }

  async finalize(e: EventItem) {
    try {
      await this.eventsService.finalize(e.id);
      await this.toast('Event finalized; no-shows cancelled.');
      await this.load();
    } catch (err) { await this.toast((err as Error).message); }
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}