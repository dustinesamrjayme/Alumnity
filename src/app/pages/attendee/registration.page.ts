import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <a class="back" [routerLink]="['/tabs/events', id]">← Back to event</a>
        @if (ev(); as e) {
          <div class="eyebrow">{{ e.title }}</div>
          <h1 class="title">Your registration</h1>
          <p class="sub">Add your details to reserve your place.</p>
          <form class="form" [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-grid">
              <div class="field"><label>First name</label><input formControlName="firstName" /></div>
              <div class="field"><label>Last name</label><input formControlName="lastName" /></div>
              <div class="field span2"><label>Email</label><input type="email" formControlName="email" placeholder="maria.santos@plv.edu.ph" /></div>
              <div class="field span2"><label>Phone</label><input type="tel" formControlName="phone" placeholder="09XX XXX XXXX" /></div>
              <div class="field span2"><label>College / department</label><input formControlName="college" placeholder="Your college" /></div>
              <div class="field span2"><label>Program</label><input formControlName="program" placeholder="Your degree program" /></div>
              <div class="field span2"><label>Graduation year / batch</label><input formControlName="batch" placeholder="e.g. Batch 2016" /></div>
              <div class="field span2"><label>Event</label><input readonly [value]="e.title" /></div>
            </div>
            @if (submitted && form.invalid) { <div class="err" style="color:var(--red);font-size:12px">Fill in every field with a valid email to continue.</div> }
            <div class="notice">{{ e.fee > 0 ? 'Pay ' + store.feeLabel(e) + ' at the event. No online payment is needed.' : 'This event is free. No payment is needed.' }}</div>
            <button type="submit" class="btn primary full">Confirm registration</button>
          </form>
        }
      </div>
    </ion-content>
  `,
})
export class RegistrationPage {
  store = inject(DemoStore);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  ev = computed(() => this.store.event(this.id));
  submitted = false;

  form = (() => {
    const p = this.store.profile();
    const [first = '', ...rest] = p.name.split(' ');
    return this.fb.nonNullable.group({
      firstName: [first, Validators.required],
      lastName: [rest.join(' '), Validators.required],
      email: [p.email, [Validators.required, Validators.email]],
      phone: [p.phone, Validators.required],
      college: [p.college, Validators.required],
      program: ['', Validators.required],
      batch: [p.batch, Validators.required],
    });
  })();

  submit() {
    this.submitted = true;
    if (this.form.invalid) return;
    const ticket = this.store.register(this.id, this.form.getRawValue());
    if (!ticket) { this.store.toast('Sorry, this event is fully booked.'); return; }
    this.router.navigate(['/tabs/events', this.id, 'success', ticket.ticketId], { replaceUrl: true });
  }
}
