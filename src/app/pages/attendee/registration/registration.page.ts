import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule, AppHeaderComponent],
  templateUrl: './registration.page.html',
  styleUrl: './registration.page.scss',
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
