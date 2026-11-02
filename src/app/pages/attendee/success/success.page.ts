import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../../components/app-header.component';
import { DemoStore } from '../../../core/demo-store.service';

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [IonContent, RouterLink, AppHeaderComponent],
  templateUrl: './success.page.html',
  styleUrl: './success.page.scss',
})
export class SuccessPage {
  store = inject(DemoStore);
  private r = inject(ActivatedRoute).snapshot.paramMap;
  ticketId = this.r.get('ticketId') ?? '';
  ev = computed(() => this.store.event(this.r.get('id')));
}
