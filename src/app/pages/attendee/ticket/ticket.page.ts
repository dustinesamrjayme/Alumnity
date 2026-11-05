import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import QRCode from 'qrcode';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './ticket.page.html',
  styleUrl: './ticket.page.scss',
})
export class TicketPage {
  store = inject(DemoStore);
  private ticketId = inject(ActivatedRoute).snapshot.paramMap.get('ticketId');
  t = computed(() => this.store.ticket(this.ticketId));
  ev = computed(() => { const t = this.t(); return t ? this.store.event(t.eventId) : undefined; });
  qr = signal('');

  constructor() {
    if (this.ticketId) {
      QRCode.toDataURL(this.ticketId, { width: 400, margin: 1, color: { dark: '#14284B', light: '#FFFFFF' } })
        .then((url) => this.qr.set(url))
        .catch(() => this.store.toast('Could not generate the QR code.'));
    }
  }

  download(id: string) {
    const url = this.qr();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.png`;
    a.click();
  }
}
