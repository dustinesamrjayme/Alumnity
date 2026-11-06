// ticket.page.ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import QRCode from 'qrcode';
import { AuthService } from '../../../core/repositories/auth.service';
import { RegistrationsService } from '../../../core/repositories/registrations.service';
import { MyTicket } from '../../../core/models';
import { DateLabelPipe, TimeLabelPipe, FeeLabelPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [IonContent, RouterLink, DateLabelPipe, TimeLabelPipe, FeeLabelPipe],
  templateUrl: './ticket.page.html',
  styleUrl: './ticket.page.scss',
})
export class TicketPage {
  auth = inject(AuthService);
  private registrations = inject(RegistrationsService);
  private toastCtrl = inject(ToastController);
  private ticketId = Number(inject(ActivatedRoute).snapshot.paramMap.get('ticketId'));

  ticket = signal<MyTicket | null>(null);
  qr = signal('');

  constructor() { void this.load(); }

  private async load() {
    if (!this.ticketId || Number.isNaN(this.ticketId)) return;
    const tickets = await this.registrations.myTickets();
    const t = tickets.find((x) => x.id === this.ticketId) ?? null;
    this.ticket.set(t);
    if (t) {
      const url = await QRCode.toDataURL(t.qr_token, {
        width: 400, margin: 1, color: { dark: '#14284B', light: '#FFFFFF' },
      });
      this.qr.set(url);
    }
  }

  download() {
    const t = this.ticket();
    const url = this.qr();
    if (!t || !url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${t.id}.png`;
    a.click();
  }
}