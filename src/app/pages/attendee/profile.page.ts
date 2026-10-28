import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header.component';
import { DemoStore } from '../../core/demo-store.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule, AppHeaderComponent],
  template: `
    <app-header />
    <ion-content>
      <div class="main">
        <div class="eyebrow">Your alumni account</div>
        <h1 class="title">Profile</h1>
        <p class="sub">Manage your contact and graduation details.</p>
        <div class="card center">
          <div class="avatar" style="margin:auto;width:64px;height:64px;font-size:20px">{{ store.initials() }}</div>
          <h2 style="font:800 20px Manrope;margin:12px 0 3px">{{ store.profile().name || 'PLV Alumni' }}</h2>
          <p class="small">PLV Alumni</p>
        </div>
        <form class="form" [formGroup]="form" (ngSubmit)="save()">
          <div class="field"><label>Full name</label><input formControlName="name" /></div>
          <div class="field"><label>Email</label><input type="email" formControlName="email" /></div>
          <div class="field"><label>Phone</label><input formControlName="phone" placeholder="09XX XXX XXXX" /></div>
          <div class="field"><label>College / program</label><input formControlName="college" placeholder="Your program" /></div>
          <div class="field"><label>Graduation year</label><input formControlName="batch" placeholder="Year / batch" /></div>
          <button type="submit" class="btn primary full">Save changes</button>
        </form>
        <div class="section"><h2>Organizer tools</h2></div>
        
        <button class="btn outline full mt" (click)="logout()">Log out</button>
        <button class="btn outline full mt" (click)="reset()">Reset demo data</button>
      </div>
    </ion-content>
  `,
})

// <a class="btn soft full" routerLink="/admin/dashboard">Open organizer workspace</a>
export class ProfilePage {
  store = inject(DemoStore);
  private router = inject(Router);
  form = inject(FormBuilder).nonNullable.group({ ...this.fields() });

  private fields() {
    const p = this.store.profile();
    return { name: [p.name], email: [p.email], phone: [p.phone], college: [p.college], batch: [p.batch] };
  }
  save() {
    this.store.profile.set(this.form.getRawValue());
    this.store.toast('Profile saved on this device.');
  }
  logout() {
    this.store.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
  reset() {
    this.store.resetDemo();
    this.store.toast('Demo data reset.');
  }
}
