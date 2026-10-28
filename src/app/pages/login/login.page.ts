import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule],
  template: `
    <ion-content class="login-content" [fullscreen]="true">
      <div class="login-screen">
        <section class="login-brand" aria-label="PLV Alumni Events">
          <img src="assets/plv-alumni-logo.svg" alt="PLV Alumni Events logo" />
          <h1>PLV</h1>
          <p>Alumni Events</p>
        </section>
        <section class="login-panel">
          <h2 class="title">Welcome back</h2>
          <p class="sub">Log in to see your events and tickets.</p>
          <form class="form" [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" autocomplete="email" formControlName="email" placeholder="maria.santos@plv.edu.ph" />
              @if (submitted && form.controls.email.invalid) { <div class="err">Enter a valid email address.</div> }
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" type="password" autocomplete="current-password" formControlName="password" placeholder="••••••••" />
              @if (submitted && form.controls.password.invalid) { <div class="err">Enter your password.</div> }
            </div>
            <button type="submit" class="btn primary full">Log in</button>
            <div class="login-links">
              or <a (click)="store.toast('Magic link sent (demo)')">email me a magic link</a><br /><br />
              New here? <a (click)="store.toast('Sign-up is a demo. Log in with any email and password.')">Sign up</a>
            </div>
          </form>
          <p class="demo-note">Demo prototype · Authentication not connected</p>
        </section>
      </div>
    </ion-content>
  `,
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
