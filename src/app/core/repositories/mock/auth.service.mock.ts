import { Injectable, computed, inject } from '@angular/core';
import { MockDatabase } from './mock-database.service';
import { AuthService } from '../auth.service';
import { AppUser, ProfileUpdate, SignInInput, SignUpInput } from '../../models';

const DEV_PASSWORD = 'demo1234';

@Injectable()
export class MockAuthService extends AuthService {
  private db = inject(MockDatabase);

  readonly currentUser = this.db.currentUser;
  readonly currentRole = this.db.currentRole;

  async ready(): Promise<void> { await this.db.ensureLoaded(); }

  async signIn({ email, password }: SignInInput): Promise<void> {
  await this.db.ensureLoaded();
  const user = this.db.state().users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (!user) throw new Error('No account for that email.');
  const stored = this.db.state().passwords[user.id];
  if (stored !== password) throw new Error('Incorrect password.');
  this.db.patch({ currentUserId: user.id });
}

async signUp(input: SignUpInput): Promise<void> {
  await this.db.ensureLoaded();
  const taken = this.db.state().users.some(
    (u) => u.email.toLowerCase() === input.email.toLowerCase()
  );
  if (taken) throw new Error('Email already in use.');
  const user: AppUser = {
    id: 'u-' + Math.random().toString(36).slice(2, 10),
    first_name: input.first_name, last_name: input.last_name,
    email: input.email, phone: input.phone,
    department: input.department, program: input.program, batch: input.batch,
    role: 'alumni', created_at: new Date().toISOString(),
  };
  this.db.update((s) => ({
    ...s,
    users: [...s.users, user],
    passwords: { ...s.passwords, [user.id]: input.password },
    currentUserId: user.id,
  }));
}

  async signOut(): Promise<void> {
    this.db.patch({ currentUserId: null });
  }

  async updateProfile(changes: ProfileUpdate): Promise<AppUser> {
    const uid = this.db.state().currentUserId;
    if (!uid) throw new Error('Not signed in.');
    let updated: AppUser | null = null;
    this.db.update((s) => {
      const users = s.users.map((u) => {
        if (u.id !== uid) return u;
        updated = { ...u, ...changes };
        return updated;
      });
      return { ...s, users };
    });
    return updated!;
  }

  async resendConfirmationEmail(email: string): Promise<void> {
    console.log(`Mock: Resent confirmation to ${email}`);
  }
}