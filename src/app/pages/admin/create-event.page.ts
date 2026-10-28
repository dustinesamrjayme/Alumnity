import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" routerLink="/admin/events">← Manage events</a>
        <div class="eyebrow">Event setup</div>
        <h1 class="title">{{ id ? 'Edit event' : 'Create event' }}</h1>
        <p class="sub">Keep event information clear and easy to scan.</p>
        <form class="form" [formGroup]="form" (ngSubmit)="save()">
          <div class="field"><label>Event name</label><input formControlName="title" placeholder="Grand Alumni Homecoming" /></div>
          <div class="field"><label>Date and time</label><input type="datetime-local" formControlName="startsAt" /></div>
          <div class="field"><label>Venue</label><input formControlName="venue" placeholder="PLV Gymnasium" /></div>
          <div class="form-grid">
            <div class="field"><label>Fee (₱)</label><input type="number" min="0" formControlName="fee" /></div>
            <div class="field"><label>Capacity</label><input type="number" min="1" formControlName="capacity" placeholder="200" /></div>
          </div>
          <div class="field"><label>Description</label><textarea rows="4" formControlName="description" placeholder="Event description"></textarea></div>
          <div class="field"><label>Banner image</label>
            <button type="button" class="btn outline full" (click)="store.toast('Image upload is not connected in this prototype.')">＋ Choose image</button>
          </div>
          @if (submitted && form.invalid) { <div style="color:var(--red);font-size:12px;margin-bottom:10px">Complete the name, date, venue and capacity.</div> }
          <button type="submit" class="btn primary full">Save event</button>
        </form>
      </div>
    </ion-content>
  `,
})
export class CreateEventPage {
  store = inject(DemoStore);
  private router = inject(Router);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  submitted = false;
  form = inject(FormBuilder).nonNullable.group({
    title: ['', Validators.required],
    startsAt: ['', Validators.required],
    venue: ['', Validators.required],
    fee: [0, [Validators.required, Validators.min(0)]],
    capacity: [200, [Validators.required, Validators.min(1)]],
    description: [''],
  });

  constructor() {
    const e = this.store.event(this.id);
    if (e) this.form.patchValue({ title: e.title, startsAt: e.startsAt, venue: e.venue, fee: e.fee, capacity: e.capacity, description: e.description });
  }

  save() {
    this.submitted = true;
    if (this.form.invalid) return;
    this.store.saveEvent(this.form.getRawValue(), this.id);
    this.store.toast(this.id ? 'Event updated.' : 'Event saved on this device.');
    this.router.navigateByUrl('/admin/events');
  }
}
