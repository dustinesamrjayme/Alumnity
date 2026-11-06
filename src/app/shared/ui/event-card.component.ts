import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventWithAvailability } from '../../core/models';
import { DateLabelPipe, FeeLabelPipe, EventThemePipe } from '../pipes/format.pipes';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [RouterLink, DateLabelPipe, FeeLabelPipe, EventThemePipe],
  template: `
    <article class="card event-card">
      <div class="event-cover"
           [class.green]="(event().id | eventTheme) === 'green'"
           [class.sky]="(event().id | eventTheme) === 'sky'"
           [attr.aria-label]="event().name">
        <span class="pill"
              [class.green]="(event().id | eventTheme) === 'green'">
          {{ event().event_date | dateLabel }}
        </span>
      </div>
      <div class="event-content">
        <h2 class="event-title">{{ event().name }}</h2>
        <div class="event-meta">
          <span>⌖ {{ event().venue }}</span>
          <span>
            @if (event().available === 0) { Fully booked }
            @else if (event().available == null) { Unlimited slots }
            @else { {{ event().available }} slots left }
          </span>
        </div>
        <div class="event-bottom">
          <span class="price">{{ event().price | feeLabel }}</span>
          <a class="btn primary" [routerLink]="[linkPrefix(), event().id]">View event</a>
        </div>
      </div>
    </article>
  `,
  styles: [`:host { display: block; }`],
})
export class EventCardComponent {
  event = input.required<EventWithAvailability>();
  linkPrefix = input<string>('/tabs/events');
}