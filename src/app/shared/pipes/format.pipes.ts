import { Pipe, PipeTransform } from '@angular/core';

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const LONG_DATE  = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const TIME       = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const PESO       = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
});

@Pipe({ name: 'dateLabel', standalone: true })
export class DateLabelPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '';
    return SHORT_DATE.format(new Date(iso));
  }
}

@Pipe({ name: 'longDate', standalone: true })
export class LongDatePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '';
    return LONG_DATE.format(new Date(iso));
  }
}

@Pipe({ name: 'timeLabel', standalone: true })
export class TimeLabelPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '';
    return TIME.format(new Date(iso));
  }
}

@Pipe({ name: 'feeLabel', standalone: true })
export class FeeLabelPipe implements PipeTransform {
  transform(price: number | null | undefined): string {
    if (price == null || price === 0) return 'Free';
    return PESO.format(price);
  }
}

export type EventTheme = 'navy' | 'green' | 'sky';

@Pipe({ name: 'eventTheme', standalone: true })
export class EventThemePipe implements PipeTransform {
  transform(id: number | null | undefined): EventTheme {
    if (id == null) return 'navy';
    const themes: EventTheme[] = ['navy', 'green', 'sky'];
    return themes[Math.abs(id) % themes.length];
  }
}