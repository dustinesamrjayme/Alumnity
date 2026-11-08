// signup.page.ts
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/repositories/auth.service';
import { Department, Program } from '../../core/models';
import { IonContent, IonIcon } from '@ionic/angular/standalone'; 
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';

const DEPARTMENTS: Department[] = ['CEIT', 'CABA', 'COE', 'CAS'];
const PROGRAMS: Program[] = ['BSEE', 'BSIT', 'BSCE'];

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const cpw = group.get('confirm_password')?.value;
  return pw === cpw ? null : { mismatch: true };
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, RouterLink, IonIcon],
  templateUrl: './signup.page.html',
  styleUrl: './signup.page.scss',
})
export class SignUpPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  showPassword = signal(false);

  readonly departments = DEPARTMENTS;
  readonly programs = PROGRAMS;
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly currentYear = new Date().getFullYear();
  readonly years = Array.from({ length: 50 }, (_, i) => this.currentYear - i);

  form = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name:  ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
    phone:      ['', Validators.required],
    department: ['CEIT' as Department, Validators.required],
    program:    ['BSIT' as Program, Validators.required],
    batch: [this.currentYear, Validators.required], 
  }, { validators: passwordsMatch });

constructor(){addIcons({ eyeOutline, eyeOffOutline });}

async submit() {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) return;

    this.busy.set(true);
    try {
      const { confirm_password: _c, ...input } = this.form.getRawValue();
      await this.auth.signUp(input);
      
      // Check if the user is logged in immediately (mock mode or email confirm OFF)
      if (this.auth.currentUser()) {
        await this.router.navigateByUrl('/tabs/events', { replaceUrl: true });
      } else {
        // Email confirmation is ON. Pass the email to the check-email page.
        await this.router.navigate(['/check-email'], { 
          queryParams: { email: input.email },
          replaceUrl: true 
        });
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}