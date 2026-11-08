// login.page.ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/repositories/auth.service';
import { environment } from '../../../environments/environment';
import { UserRole } from '../../core/models';
import { IonContent, IonIcon } from '@ionic/angular/standalone'; // <-- Add IonIcon
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons'; // 

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, RouterLink, IonIcon], 
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  showPassword = signal(false);

  readonly isMock = environment.useMock;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() { 
     this.route.queryParams.subscribe(params => {
    if (params['verified'] === 'true') {
      // Show a toast: "Email verified! Please log in."
    }
  });
    void this.redirectIfSignedIn();   addIcons({ eyeOutline, eyeOffOutline }); 
  }

  private async redirectIfSignedIn() {
    await this.auth.ready();
    const user = this.auth.currentUser();
    if (user) await this.router.navigateByUrl(this.homeFor(user.role), { replaceUrl: true });
  }

  private homeFor(role: UserRole): string {
    return role === 'admin' ? '/admin/dashboard'
         : role === 'volunteer' ? '/volunteer/events'
         : '/tabs/events';
  }

  async submit() {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) return;

    this.busy.set(true);
    try {
      await this.auth.signIn(this.form.getRawValue());
      const role = this.auth.currentRole();
      if (role) await this.router.navigateByUrl(this.homeFor(role), { replaceUrl: true });
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}