import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  store = inject(DemoStore);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  submitted = false;
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    if (this.store.session()) this.router.navigateByUrl('/tabs/events', { replaceUrl: true });
  }

  submit() {
    this.submitted = true;
    if (this.form.invalid) return;
    this.store.login(this.form.controls.email.value.trim());
    this.router.navigateByUrl('/tabs/events', { replaceUrl: true });
  }
}
