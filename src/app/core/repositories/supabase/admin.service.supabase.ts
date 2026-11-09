import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { AppUser, AuditLogEntry, EventDashboardStats, UserRole } from '../../models';
import { AdminService, AlumniSummary } from '../admin.service';

@Injectable()
export class SupabaseAdminService extends AdminService {
  private sb: SupabaseClient = createClient(
    environment.supabaseUrl, environment.supabaseAnonKey,
  );

  private unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
    if (res.error) {
      const err = new Error(res.error.message) as Error & { code?: string };
      err.code = res.error.code;
      throw err;
    }
    return res.data as T;
  }

  async dashboard(): Promise<EventDashboardStats[]> {
    return this.unwrap(await this.sb.rpc('get_event_dashboard'));
  }

  async searchUsers(term: string): Promise<AppUser[]> {
    return this.unwrap(await this.sb.rpc('search_users', { p_term: term }));
  }

  async setUserRole(userId: string, role: UserRole): Promise<AppUser> {
    return this.unwrap(await this.sb.rpc('admin_set_user_role', { p_user_id: userId, p_role: role }));
  }

  async auditLog(limit = 100): Promise<AuditLogEntry[]> {
    return this.unwrap(
      await this.sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
    );
  }

  async finalizePastEvents(graceHours = 12): Promise<number> {
    const res = this.unwrap(
      await this.sb.rpc('finalize_past_events', { p_grace_hours: graceHours }),
    );
    return typeof res === 'number' ? res : 0;
  }

  async alumniSummary(): Promise<AlumniSummary> {
    return this.unwrap(await this.sb.rpc('get_alumni_summary'));
  }
}