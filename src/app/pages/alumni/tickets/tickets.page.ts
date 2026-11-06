// tickets.page.ts
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { MyTicket } from '../../../core/models';
import { DateLabelPipe, TimeLabelPipe, FeeLabelPipe, EventThemePipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, TimeLabelPipe, FeeLabelPipe, EventThemePipe],
  templateUrl: './tickets.page.html',
  styleUrl: './tickets.page.scss',
})
export class TicketsPage {
  private registrations = inject(RegistrationsService);
  rows = signal<MyTicket[]>([]);

  constructor() { void this.load(); }
  private async load() {
    this.rows.set(await this.registrations.myTickets());
  }
}