import { Injectable, computed, inject, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import {
  AppUser, ProfileUpdate, SignInInput, SignUpInput, UserRole, USER_COLUMNS,
} from '../../models';

@Injectable()
export class SupabaseAuthService extends AuthService {
  private sb: SupabaseClient = createClient(
    environment.supabaseUrl, environment.supabaseAnonKey,
    { auth: { persistSession: true, autoRefreshToken: true } },
  );

  private _currentUser = signal<AppUser | null>(null);
  private _currentRole = signal<UserRole | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly currentRole = this._currentRole.asReadonly();

  private readyPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.sb.auth.onAuthStateChange(() => { void this.refresh(); });
  }

  async ready(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.refresh();
    return this.readyPromise;
  }

  private async refresh(): Promise<void> {
    const { data: sessionData } = await this.sb.auth.getSession();
    if (!sessionData.session) {
      this._currentUser.set(null);
      this._currentRole.set(null);
      return;
    }
    const { data: row, error } = await this.sb
      .from('users').select(USER_COLUMNS)
      .eq('id', sessionData.session.user.id).single<AppUser>();
    if (error) { this._currentUser.set(null); this._currentRole.set(null); return; }
    this._currentUser.set(row);
    this._currentRole.set(row.role);
  }

  async signIn({ email, password }: SignInInput): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.refresh();
  }

  async signUp(input: SignUpInput): Promise<void> {
    const { email, password, ...profile } = input;
    const { error } = await this.sb.auth.signUp({
      email, password, options: { data: profile },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
    this._currentUser.set(null);
    this._currentRole.set(null);
  }

  async updateProfile(changes: ProfileUpdate): Promise<AppUser> {
    const uid = this._currentUser()?.id;
    if (!uid) throw new Error('Not signed in.');
    const { data, error } = await this.sb.from('users')
      .update(changes).eq('id', uid).select(USER_COLUMNS).single<AppUser>();
    if (error) throw error;
    this._currentUser.set(data);
    return data;
  }
}