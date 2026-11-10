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

const PROGRAMS_BY_DEPARTMENT: Record<Department, Program[]> = {
  CEIT: ['BSIT', 'BSCE', 'BSEE'],
  CABA: ['BSA', 'BSBA FM', 'BSBA HRDM', 'BSBA MM'],
  COED: ['BECED', 'BSED English', 'BSED Filipino', 'BSED Mathematics', 'BSED Science', 'BSED Social Studies'],
  CPAG: ['BSPA'],
  CAS:  ['BAC', 'BSP', 'BSSW'],
};

const DEPARTMENTS = Object.keys(PROGRAMS_BY_DEPARTMENT) as Department[];

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
  get programs(): Program[] {
  return PROGRAMS_BY_DEPARTMENT[this.form.controls.department.value];
}

onDepartmentChange() {
  this.form.controls.program.setValue(this.programs[0]);
}
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly currentYear = new Date().getFullYear();
  readonly years = Array.from(
    { length: this.currentYear - 2002 + 1 },
    (_, i) => this.currentYear - i
  );

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
    await this.router.navigateByUrl('/account-created', { replaceUrl: true });
  } catch (e) {
    this.error.set((e as Error).message);
  } finally {
    this.busy.set(false);
  }
}
}