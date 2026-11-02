import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-past-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './past-events.page.html',
  styleUrl: './past-events.page.scss',
})
export class PastEventsPage {
  store = inject(DemoStore);
}
