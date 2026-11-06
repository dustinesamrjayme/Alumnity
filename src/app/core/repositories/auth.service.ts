import { Signal } from '@angular/core';
import { AppUser, ProfileUpdate, SignInInput, SignUpInput, UserRole } from '../models';

export abstract class AuthService {
  abstract readonly currentUser: Signal<AppUser | null>;
  abstract readonly currentRole: Signal<UserRole | null>;
  abstract ready(): Promise<void>;
  abstract signIn(input: SignInInput): Promise<void>;
  abstract signUp(input: SignUpInput): Promise<void>;
  abstract signOut(): Promise<void>;
  abstract updateProfile(changes: ProfileUpdate): Promise<AppUser>;
}