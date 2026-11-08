// src/app/core/api.service.ts
import { Injectable } from '@angular/core';
import QRCode from 'qrcode';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  AppUser,
  Attendee,
  AttendeeStatus,
  AuditLogEntry,
  CheckInLogEntry,
  EventDashboardStats,
  EventItem,
  MyTicket,
  NewEvent,
  PendingCheckIn,
  ProfileUpdate,
  Registration,
  ScanResult,
  SignInInput,
  SignUpInput,
  SyncResult,
  UserRole,
  USER_COLUMNS,
  EventUpdate
} from '../core/models';  

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly qrBucket = 'registration-qr';

  readonly sb: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  // ---------- helpers ----------
  private unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
    if (res.error) {
      const err = new Error(res.error.message) as Error & { code?: string };
      err.code = res.error.code;
      throw err;
    }
    return res.data as T;
  }

  // ---------- auth ----------
  async signUp(input: SignUpInput): Promise<void> {
    const { email, password, ...profile } = input;
    // profile fields travel as metadata; the DB trigger builds the users row (role = alumni)
    const { error } = await this.sb.auth.signUp({ email, password, options: { data: profile } });
    if (error) throw error;
  }

  async signIn(input: SignInInput): Promise<Session> {
    const { data, error } = await this.sb.auth.signInWithPassword(input);
    if (error) throw error;
    return data.session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.sb.auth.signOut();
    if (error) throw error;
  }

  /** Call after an admin changes a role so the new JWT claim is picked up. */
  async refreshSession(): Promise<void> {
    const { error } = await this.sb.auth.refreshSession();
    if (error) throw error;
  }

  /** Role claim injected by the Custom Access Token Hook. */
  async currentRole(): Promise<UserRole | null> {
    const { data } = await this.sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return (JSON.parse(atob(payload)).user_role as UserRole) ?? null;
    } catch {
      return null;
    }
  }

  // ---------- profile ----------
  async myProfile(): Promise<AppUser> {
    const { data: auth } = await this.sb.auth.getUser();
    return this.unwrap(
      await this.sb.from('users').select(USER_COLUMNS).eq('id', auth.user!.id).single<AppUser>(),
    );
  }

  async updateProfile(changes: ProfileUpdate): Promise<AppUser> {
    const { data: auth } = await this.sb.auth.getUser();
    return this.unwrap(
      await this.sb.from('users').update(changes).eq('id', auth.user!.id).select(USER_COLUMNS).single<AppUser>(),
    );
  }

  // ---------- events ----------
  async listEvents(): Promise<EventItem[]> {
    return this.unwrap(
      await this.sb.from('events').select('*').eq('status', 'listed').order('event_date', { ascending: true }),
    );
  }

  async getEvent(id: number): Promise<EventItem> {
    return this.unwrap(await this.sb.from('events').select('*').eq('id', id).single<EventItem>());
  }

  // admin
  async createEvent(e: NewEvent): Promise<EventItem> {
    return this.unwrap(await this.sb.from('events').insert(e).select().single<EventItem>());
  }

  async updateEvent(id: number, changes: EventUpdate): Promise<EventItem> {
    return this.unwrap(await this.sb.from('events').update(changes).eq('id', id).select().single<EventItem>());
  }

  async closeEvent(id: number): Promise<EventItem> {
    return this.unwrap(
      await this.sb.from('events').update({ status: 'closed' }).eq('id', id).select().single<EventItem>(),
    );
  }

  // ---------- registrations (alumni) ----------
  async register(eventId: number): Promise<Registration> {
    const registration = this.unwrap(
      await this.sb.rpc('register_for_event', { p_event_id: eventId }),
    ) as Registration;

    // The database registration is already committed at this point. If Storage
    // fails, surface that distinction so the UI does not imply registration failed.
    try {
      await this.uploadRegistrationQR(registration.qr_token);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown Storage error';
      throw new Error(
        `Registration ${registration.id} was created, but its QR image could not be uploaded. ` +
        `You can retry with uploadRegistrationQR('${registration.qr_token}'). ${reason}`,
      );
    }

    return registration;
  }

  /**
   * Generate a PNG containing the raw UUID token and store it in the private
   * `registration-qr` bucket at `registrations/<token>.png`.
   *
   * The QR payload deliberately contains only the token, not a Storage URL.
   */
  async uploadRegistrationQR(qrToken: string): Promise<string> {
    if (!qrToken) throw new Error('A QR token is required.');

    const dataUrl = await QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 512,
      type: 'image/png',
    });
    const imageBlob = await (await fetch(dataUrl)).blob();
    const filePath = this.registrationQRPath(qrToken);

    const { data, error } = await this.sb.storage
      .from(this.qrBucket)
      .upload(filePath, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        // Retrying registration QR generation should safely replace the same
        // deterministic image rather than fail with an already-exists error.
        upsert: true,
      });

    if (error) throw error;
    return data.path;
  }

  /** Create a short-lived URL for displaying a stored registration QR image. */
  async getRegistrationQR(qrToken: string): Promise<string> {
    if (!qrToken) throw new Error('A QR token is required.');

    const { data, error } = await this.sb.storage
      .from(this.qrBucket)
      .createSignedUrl(this.registrationQRPath(qrToken), 3600);

    if (error) throw error;
    return data.signedUrl;
  }

  private registrationQRPath(qrToken: string): string {
    return `registrations/${qrToken}.png`;
  }

  async cancelRegistration(registrationId: number): Promise<Registration> {
    return this.unwrap(await this.sb.rpc('cancel_registration', { p_registration_id: registrationId }));
  }

  async myTickets(): Promise<MyTicket[]> {
    return this.unwrap(
      await this.sb
        .from('registrations')
        .select('*, event:events(id, name, venue, event_date, price, status, banner_url)')
        .order('created_at', { ascending: false }),
    );
  }

  // ---------- check-in (volunteer / admin) ----------
  async attendeeList(eventId: number): Promise<Attendee[]> {
    return this.unwrap(await this.sb.rpc('get_attendee_list', { p_event_id: eventId }));
  }

  async confirmPayment(registrationId: number): Promise<Registration> {
    return this.unwrap(await this.sb.rpc('confirm_payment', { p_registration_id: registrationId }));
  }

  /** Send queued scans; the server is idempotent on client_id, so retrying is safe. */
  async syncCheckIns(batch: PendingCheckIn[]): Promise<SyncResult[]> {
    return this.unwrap(await this.sb.rpc('sync_check_ins', { p_batch: batch }));
  }

  async checkInLog(eventId: number): Promise<CheckInLogEntry[]> {
    return this.unwrap(
      await this.sb.from('check_in_log').select('*').eq('event_id', eventId).order('device_time', { ascending: false }),
    );
  }

  // ---------- admin ----------
  async dashboard(): Promise<EventDashboardStats[]> {
    return this.unwrap(await this.sb.rpc('get_event_dashboard'));
  }

  async setUserRole(userId: string, role: UserRole): Promise<AppUser> {
    return this.unwrap(await this.sb.rpc('admin_set_user_role', { p_user_id: userId, p_role: role }));
  }

  async searchUsers(term: string): Promise<AppUser[]> {
    return this.unwrap(
      await this.sb
        .from('users')
        .select(USER_COLUMNS)
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .limit(25),
    );
  }

  async auditLog(limit = 100): Promise<AuditLogEntry[]> {
    return this.unwrap(
      await this.sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
    );
  }
}
