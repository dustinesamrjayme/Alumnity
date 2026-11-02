import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './events.page.html',
  styleUrl: './events.page.scss',
})
export class EventsPage {
  store = inject(DemoStore);
}
