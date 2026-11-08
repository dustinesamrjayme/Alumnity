import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/repositories/auth.service';

@Component({
  selector: 'app-check-email',
  standalone: true,
  imports: [IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="main center" style="padding-top: 80px;">
        <div class="success-icon">✉️</div>
        <h1 class="title">Check your email</h1>
        <p class="sub">We've sent a confirmation link to your email address. Click the link to verify your account and log in.</p>
        <a class="btn primary full mt2" routerLink="/login">Back to Login</a>
        <button class="btn soft full mt2" (click)="resend()">Resend email</button>
      </div>
    </ion-content>
  `,
})
export class CheckEmailPage {
  private auth = inject(AuthService);
  private toastCtrl = inject(ToastController);

  async resend() {
    const email = this.auth.currentUser()?.email; // Or store the email in a signal
    if (!email) return;
    try {
      // You may need to expose a resend method in your AuthService
      await (this.auth as any).sb.auth.resend({ type: 'signup', email });
      const t = await this.toastCtrl.create({ message: 'Email resent!', duration: 2000 });
      await t.present();
    } catch (e) {
      const t = await this.toastCtrl.create({ message: (e as Error).message, duration: 2000 });
      await t.present();
    }
  }
}