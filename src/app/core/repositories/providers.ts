import { Provider } from '@angular/core';
import { environment } from '../../../environments/environment';

import { AuthService } from './auth.service';
import { EventsService } from './events.service';
import { RegistrationsService } from './registrations.service';
import { CheckInService } from './checkin.service';
import { AdminService } from './admin.service';

import { MockAuthService } from './mock/auth.service.mock';
import { MockEventsService } from './mock/events.service.mock';
import { MockRegistrationsService } from './mock/registrations.service.mock';
import { MockCheckInService } from './mock/checkin.service.mock';
import { MockAdminService } from './mock/admin.service.mock';

import { SupabaseAuthService } from './supabase/auth.service.supabase';
import { SupabaseEventsService } from './supabase/events.service.supabase';
import { SupabaseRegistrationsService } from './supabase/registrations.service.supabase';
import { SupabaseCheckInService } from './supabase/checkin.service.supabase';
import { SupabaseAdminService } from './supabase/admin.service.supabase';

const MOCK: Provider[] = [
  { provide: AuthService, useClass: MockAuthService },
  { provide: EventsService, useClass: MockEventsService },
  { provide: RegistrationsService, useClass: MockRegistrationsService },
  { provide: CheckInService, useClass: MockCheckInService },
  { provide: AdminService, useClass: MockAdminService },
];

const SUPABASE: Provider[] = [
  { provide: AuthService, useClass: SupabaseAuthService },
  { provide: EventsService, useClass: SupabaseEventsService },
  { provide: RegistrationsService, useClass: SupabaseRegistrationsService },
  { provide: CheckInService, useClass: SupabaseCheckInService },
  { provide: AdminService, useClass: SupabaseAdminService },
];

export const REPOSITORY_PROVIDERS: Provider[] = environment.useMock ? MOCK : SUPABASE;