import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule, AppHeaderComponent],
  templateUrl: './create-event.page.html',
  styleUrl: './create-event.page.scss',
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
