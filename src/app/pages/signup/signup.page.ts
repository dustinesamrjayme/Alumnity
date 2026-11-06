// signup.page.ts
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/repositories/auth.service';
import { Department, Program } from '../../core/models';

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
  imports: [IonContent, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.page.html',
  styleUrl: './signup.page.scss',
})
export class SignUpPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly departments = DEPARTMENTS;
  readonly programs = PROGRAMS;
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  form = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name:  ['', Validators.required],
    username:   ['', [Validators.required, Validators.minLength(3)]],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
    phone:      ['', Validators.required],
    department: ['CEIT' as Department, Validators.required],
    program:    ['BSIT' as Program, Validators.required],
    batch:      ['', Validators.required],
  }, { validators: passwordsMatch });

async submit() {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const { confirm_password: _c, ...input } = this.form.getRawValue();
      await this.auth.signUp(input);
      if (this.auth.currentUser()) {
        await this.router.navigateByUrl('/tabs/events', { replaceUrl: true });
      } else {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}