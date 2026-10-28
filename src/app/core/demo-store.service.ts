import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

export type Theme = 'navy' | 'green' | 'sky';

export interface EventItem {
  id: string; title: string; startsAt: string; venue: string; fee: number;
  capacity: number; registered: number; checkedIn: number; description: string;
  theme: Theme; open: boolean;
}
export interface Ticket {
  ticketId: string; eventId: string; name: string; email: string; phone: string;
  college: string; program: string; batch: string; checkedIn: boolean; createdAt: number;
}
export interface Attendee { ticketId: string; name: string; email: string; checkedIn: boolean; }
export interface Profile { name: string; email: string; phone: string; college: string; batch: string; }
export interface Session { email: string; name: string; }
export interface PastEvent { id: string; title: string; dateLabel: string; venue: string; registered: number; checkedIn: number; }
export type AttendeeMap = Record<string, Attendee[]>;

interface Persisted {
  session: Session | null; profile: Profile; events: EventItem[]; tickets: Ticket[];
  attendees: AttendeeMap; pending: number; lastSynced: string; listCached: boolean;
}

const KEY = 'plv.alumni.demo.v1';

const SEED_EVENTS: EventItem[] = [
  { id: 'grand-alumni-homecoming', title: 'Grand Alumni Homecoming', startsAt: '2026-12-12T16:00', venue: 'PLV Gymnasium', fee: 1500, capacity: 200, registered: 158, checkedIn: 64, theme: 'navy', open: true,
    description: 'A night for alumni to reconnect, meet friends from different batches, and celebrate the PLV journey. Bring your ticket QR code for check-in.' },
  { id: 'batch-2016-reunion', title: 'Batch 2016 Reunion', startsAt: '2026-11-28T14:00', venue: 'Function Hall', fee: 800, capacity: 94, registered: 82, checkedIn: 0, theme: 'green', open: true,
    description: 'Ten years on. Catch up with your batchmates over dinner and a short program.' },
  { id: 'alumni-career-connect', title: 'Alumni Career Connect', startsAt: '2027-01-17T09:00', venue: 'PLV Main Campus', fee: 0, capacity: 150, registered: 90, checkedIn: 0, theme: 'sky', open: true,
    description: 'Meet alumni mentors, hear industry talks, and expand your professional network.' },
];
const SEED_TICKETS: Ticket[] = [
  { ticketId: 'PLV-ALM-2026-00482', eventId: 'grand-alumni-homecoming', name: 'Maria Santos', email: 'maria.santos@plv.edu.ph', phone: '', college: '', program: '', batch: '', checkedIn: false, createdAt: Date.now() },
  { ticketId: 'PLV-B16-2026-00117', eventId: 'batch-2016-reunion', name: 'Maria Santos', email: 'maria.santos@plv.edu.ph', phone: '', college: '', program: '', batch: 'Batch 2016', checkedIn: false, createdAt: Date.now() },
];
const SEED_ATTENDEES: AttendeeMap = {
  'grand-alumni-homecoming': [
    { ticketId: 'PLV-ALM-2026-00482', name: 'Maria Santos', email: 'maria.santos@plv.edu.ph', checkedIn: false },
    { ticketId: 'PLV-ALM-2026-00103', name: 'John Reyes', email: 'john.reyes@example.com', checkedIn: true },
    { ticketId: 'PLV-ALM-2026-00219', name: 'Angela Cruz', email: 'angela.cruz@example.com', checkedIn: false },
    { ticketId: 'PLV-ALM-2026-00331', name: 'Paolo Garcia', email: 'paolo.garcia@example.com', checkedIn: false },
  ],
  'batch-2016-reunion': [
    { ticketId: 'PLV-B16-2026-00117', name: 'Maria Santos', email: 'maria.santos@plv.edu.ph', checkedIn: false },
    { ticketId: 'PLV-B16-2026-00122', name: 'Liza Mendoza', email: 'liza.mendoza@example.com', checkedIn: false },
  ],
  'alumni-career-connect': [],
};
const EMPTY_PROFILE: Profile = { name: '', email: '', phone: '', college: '', batch: '' };
const PAST: PastEvent[] = [
  { id: 'founders-day', title: "PLV Founders' Day Reunion", dateLabel: 'Aug 10', venue: 'PLV Gymnasium', registered: 210, checkedIn: 184 },
];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

@Injectable({ providedIn: 'root' })
export class DemoStore {
  private toastCtrl = inject(ToastController);
  private saved = this.load();

  readonly session = signal<Session | null>(this.saved?.session ?? null);
  readonly profile = signal<Profile>(this.saved?.profile ?? clone(EMPTY_PROFILE));
  readonly events = signal<EventItem[]>(this.saved?.events ?? clone(SEED_EVENTS));
  readonly tickets = signal<Ticket[]>(this.saved?.tickets ?? clone(SEED_TICKETS));
  readonly attendees = signal<AttendeeMap>(this.saved?.attendees ?? clone(SEED_ATTENDEES));
  readonly pending = signal(this.saved?.pending ?? 0);
  readonly lastSynced = signal(this.saved?.lastSynced ?? 'Never');
  readonly listCached = signal(this.saved?.listCached ?? false);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly pastEvents = PAST;

  readonly openEvents = computed(() => this.events().filter((e) => e.open));
  readonly initials = computed(() => {
    const n = this.profile().name || this.session()?.name || 'Alumni';
    return (n.split(/\s+/).map((s) => s[0]).join('').slice(0, 2) || 'AL').toUpperCase();
  });

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    effect(() => {
      const data: Persisted = {
        session: this.session(), profile: this.profile(), events: this.events(), tickets: this.tickets(),
        attendees: this.attendees(), pending: this.pending(), lastSynced: this.lastSynced(), listCached: this.listCached(),
      };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
    });
  }

  private load(): Persisted | null {
    try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Persisted) : null; } catch { return null; }
  }

  async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2600, position: 'bottom' });
    await t.present();
  }

  // ---- auth ----
  login(email: string) {
    const name = (email.split('@')[0] || 'Alumni').replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    this.session.set({ email, name });
    if (!this.profile().email) this.profile.set({ ...this.profile(), email, name });
  }
  logout() { this.session.set(null); }
  resetDemo() {
    this.events.set(clone(SEED_EVENTS)); this.tickets.set(clone(SEED_TICKETS)); this.attendees.set(clone(SEED_ATTENDEES));
    this.pending.set(0); this.lastSynced.set('Never'); this.listCached.set(false);
  }

  // ---- event helpers ----
  event(id: string | null | undefined) { return this.events().find((e) => e.id === id); }
  slotsLeft(e: EventItem) { return Math.max(0, e.capacity - e.registered); }
  fillPercent(e: EventItem) { return Math.min(100, Math.round((e.registered / Math.max(1, e.capacity)) * 100)); }
  feeLabel(e: EventItem) { return e.fee > 0 ? '₱' + e.fee.toLocaleString('en-PH') : 'Free'; }
  dateLabel(e: EventItem) { return new Date(e.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  longDate(e: EventItem) { return new Date(e.startsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  timeLabel(e: EventItem) { return new Date(e.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  ticket(id: string | null | undefined) { return this.tickets().find((t) => t.ticketId === id); }

  saveEvent(data: Pick<EventItem, 'title' | 'startsAt' | 'venue' | 'fee' | 'capacity' | 'description'>, id?: string | null) {
    if (id) {
      this.events.update((l) => l.map((e) => (e.id === id ? { ...e, ...data } : e)));
      return id;
    }
    const newId = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
    const themes: Theme[] = ['navy', 'green', 'sky'];
    this.events.update((l) => [...l, { ...data, id: newId, registered: 0, checkedIn: 0, theme: themes[l.length % 3], open: true }]);
    this.attendees.update((m) => ({ ...m, [newId]: [] }));
    return newId;
  }
  toggleOpen(id: string) {
    this.events.update((l) => l.map((e) => (e.id === id ? { ...e, open: !e.open } : e)));
  }

  // ---- registration ----
  register(eventId: string, form: { firstName: string; lastName: string; email: string; phone: string; college: string; program: string; batch: string }): Ticket | null {
    const ev = this.event(eventId);
    if (!ev || this.slotsLeft(ev) === 0) return null;
    const ticket: Ticket = {
      ticketId: `PLV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      eventId, name: `${form.firstName} ${form.lastName}`.trim(), email: form.email, phone: form.phone,
      college: form.college, program: form.program, batch: form.batch, checkedIn: false, createdAt: Date.now(),
    };
    this.tickets.update((l) => [...l, ticket]);
    this.events.update((l) => l.map((e) => (e.id === eventId ? { ...e, registered: e.registered + 1 } : e)));
    this.attendees.update((m) => ({ ...m, [eventId]: [...(m[eventId] ?? []), { ticketId: ticket.ticketId, name: ticket.name, email: ticket.email, checkedIn: false }] }));
    return ticket;
  }

  // ---- check-in ----
  checkIn(eventId: string, ticketId: string) {
    this.attendees.update((m) => ({ ...m, [eventId]: (m[eventId] ?? []).map((a) => (a.ticketId === ticketId ? { ...a, checkedIn: true } : a)) }));
    this.tickets.update((l) => l.map((t) => (t.ticketId === ticketId ? { ...t, checkedIn: true } : t)));
    this.events.update((l) => l.map((e) => (e.id === eventId ? { ...e, checkedIn: e.checkedIn + 1 } : e)));
    if (!this.online()) this.pending.update((n) => n + 1);
  }
  lookup(eventId: string, code: string): { state: 'valid' | 'used' | 'invalid'; attendee?: Attendee } {
    const a = (this.attendees()[eventId] ?? []).find((x) => x.ticketId.toLowerCase() === code.trim().toLowerCase());
    if (!a) return { state: 'invalid' };
    return { state: a.checkedIn ? 'used' : 'valid', attendee: a };
  }

  // ---- sync ----
  syncNow(): boolean {
    if (!this.online()) return false;
    this.pending.set(0);
    this.lastSynced.set(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }));
    return true;
  }
  cacheList() { this.listCached.set(true); }
}
