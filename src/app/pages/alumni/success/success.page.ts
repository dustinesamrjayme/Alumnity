// success.page.ts
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';
import { EventItem } from '../../../core/models';
import { FeeLabelPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [IonContent, RouterLink, FeeLabelPipe],
  templateUrl: './success.page.html',
  styleUrl: './success.page.scss',
})
export class SuccessPage {
  private r = inject(ActivatedRoute).snapshot.paramMap;
  private events = inject(EventsService);
  private eventId = Number(this.r.get('id'));
  ticketId = this.r.get('ticketId') ?? '';
  ev = signal<EventItem | null>(null);

  constructor() { void this.load(); }
  private async load() {
    try { this.ev.set(await this.events.get(this.eventId)); } catch { /* leave null */ }
  }
}