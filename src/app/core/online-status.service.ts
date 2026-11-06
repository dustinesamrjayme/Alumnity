import { Injectable, signal } from '@angular/core';

/** Mirrors navigator.onLine into a signal. One listener, one signal. */
@Injectable({ providedIn: 'root' })
export class OnlineStatusService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }
}