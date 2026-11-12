import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-account-created',
  standalone: true,
  imports: [IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="main center" style="padding-top: 80px;">
        <div class="success-icon">✅</div>
        <h1 class="title">Account created</h1>
        <p class="sub">Your account has been created successfully. You can now log in.</p>
        <a class="btn primary full mt2" routerLink="/login">Back to Login</a>
      </div>
    </ion-content>
  `,
})
export class AccountCreatedPage {}