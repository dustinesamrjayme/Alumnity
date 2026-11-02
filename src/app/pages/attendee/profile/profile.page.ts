import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IonContent, RouterLink, ReactiveFormsModule, AppHeaderComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})


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
