// profile.page.ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/repositories/auth.service';
import { CheckInService } from '../../../core/repositories/checkin.service';
import { Department, Program } from '../../../core/models';
import { TitleCasePipe } from '@angular/common';






const DEPARTMENTS: Department[] = ['CEIT', 'CABA', 'COE', 'CAS'];
const PROGRAMS: Program[] = ['BSEE', 'BSIT', 'BSCE'];

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, TitleCasePipe],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  auth = inject(AuthService);
  private checkIn = inject(CheckInService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  readonly departments = DEPARTMENTS;
  readonly programs = PROGRAMS;
  readonly busy = signal(false);

  form = inject(FormBuilder).nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: [{ value: '', disabled: true }],
    phone: ['', Validators.required],
    department: ['CEIT' as Department, Validators.required],
    program: ['BSIT' as Program, Validators.required],
    batch: ['', Validators.required],
  });

  constructor() {
    void this.hydrate();
  }

  private async hydrate() {
    await this.auth.ready();
    const u = this.auth.currentUser();
    if (!u) return;
    this.form.patchValue({
      first_name: u.first_name, last_name: u.last_name, username: u.username,
      email: u.email, phone: u.phone, department: u.department,
      program: u.program, batch: u.batch,
    });
  }

  async save() {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const { email: _e, ...changes } = this.form.getRawValue();
      await this.auth.updateProfile(changes);
      await this.toast('Profile saved.');
    } catch (e) {
      await this.toast((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    await this.checkIn.clearCachedLists();
    await this.auth.signOut();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}