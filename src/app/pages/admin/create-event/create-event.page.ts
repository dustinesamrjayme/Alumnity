// create-event.page.ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { EventsService } from '../../../core/repositories/events.service';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule],
  templateUrl: './create-event.page.html',
  styleUrl: './create-event.page.scss',
})
export class CreateEventPage {
  private events = inject(EventsService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  submitted = signal(false);
  busy = signal(false);

  form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    event_date: ['', Validators.required],
    venue: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    capacity: [200 as number | null, [Validators.min(1)]],
    description: [''],
    banner_url: [null as string | null],
  });

  constructor() {
    if (this.id) void this.load();
  }

  private async load() {
    const e = await this.events.get(Number(this.id));
    this.form.patchValue({
      name: e.name, event_date: this.toLocalInput(e.event_date),
      venue: e.venue, price: e.price ?? 0, capacity: e.capacity,
      description: e.description, banner_url: e.banner_url,
    });
  }

  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async save() {
    this.submitted.set(true);
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const raw = this.form.getRawValue();
      const payload = {
        name: raw.name,
        event_date: new Date(raw.event_date).toISOString(),
        venue: raw.venue,
        price: raw.price,
        capacity: raw.capacity,
        description: raw.description,
        banner_url: raw.banner_url,
      };
      if (this.id) {
        await this.events.update(Number(this.id), payload);
        await this.toast('Event updated.');
      } else {
        await this.events.create(payload);
        await this.toast('Event created.');
      }
      await this.router.navigateByUrl('/admin/events');
    } catch (e) { await this.toast((e as Error).message); }
    finally { this.busy.set(false); }
  }

  async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }

  async notReady(message: string) {
    await this.toast(message);
  } 
}