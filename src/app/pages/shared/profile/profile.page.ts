import { Component, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController, AlertController } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/repositories/auth.service';
import { CheckInService } from '../../../core/repositories/checkin.service';
import { StorageService } from '../../../core/storage.service';
import { Department, Program } from '../../../core/models';

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
  private storage = inject(StorageService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  readonly departments = DEPARTMENTS;
  readonly programs = PROGRAMS;
  readonly busy = signal(false);
  readonly currentYear = new Date().getFullYear();  
  readonly years = Array.from({ length: 50 }, (_, i) => this.currentYear - i);

  form = inject(FormBuilder).nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: [{ value: '', disabled: true }],
    phone: ['', Validators.required],
    department: ['CEIT' as Department, Validators.required],
    program: ['BSIT' as Program, Validators.required],
    batch: [this.currentYear, Validators.required],
  });

  constructor() {
    void this.hydrate();
  }

  private async hydrate() {
    await this.auth.ready();
    const u = this.auth.currentUser();
    if (!u) return;
    this.form.patchValue({
      first_name: u.first_name, last_name: u.last_name, 
      email: u.email, phone: u.phone, department: u.department,
      program: u.program, batch: u.batch,
    });
  }

  // --- SAVE CHANGES ---
  async save() {
    if (this.form.invalid) return;

    const alert = await this.alertCtrl.create({
      header: 'Save Changes',
      message: 'Are you sure you want to update your profile details?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: () => { void this.executeSave(); }
        }
      ]
    });
    await alert.present();
  }

  private async executeSave() {
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

  // --- LOGOUT ---
  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Log Out',
      message: 'Are you sure you want to log out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Log out',
          role: 'destructive',
          handler: () => { void this.executeLogout(); }
        }
      ]
    });
    await alert.present();
  }

  private async executeLogout() {
    // 1. Guard against losing unsynced data
    if (this.checkIn.pendingCount() > 0) {
      const alert = await this.alertCtrl.create({
        header: 'Unsynced Data',
        message: `You have ${this.checkIn.pendingCount()} pending check-in(s). If you log out now, this data will be lost. Please go to the Sync page first.`,
        buttons: ['OK']
      });
      await alert.present();
      return; // Stop logout
    }

    // 2. Clear everything and log out
    await this.storage.clear(); 
    await this.auth.signOut();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}