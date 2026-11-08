import { Injectable, inject } from '@angular/core';
import { MockDatabase } from './mock-database.service';
import { AdminService } from '../admin.service';
import { AppUser, AuditLogEntry, EventDashboardStats, UserRole } from '../../models';

@Injectable()
export class MockAdminService extends AdminService {
  private db = inject(MockDatabase);

  private requireAdmin(): void {
    if (this.db.currentRole() !== 'admin') throw new Error('Not allowed.');
  }

  async dashboard(): Promise<EventDashboardStats[]> {
    await this.db.ensureLoaded();
    this.requireAdmin();
    const s = this.db.state();
    return s.events.map((e) => {
      const regs = s.registrations.filter((r) => r.event_id === e.id);
      const active = regs.filter((r) => r.attendee_status !== 'cancelled');
      const paid = regs.filter((r) => r.payment_status === 'paid');
      return {
        event_id: e.id, name: e.name, capacity: e.capacity,
        registered: active.length,
        checked_in: regs.filter((r) => r.attendee_status === 'checked_in').length,
        cancelled: regs.filter((r) => r.attendee_status === 'cancelled').length,
        paid: paid.length,
        unpaid: active.filter((r) => r.payment_status === 'unpaid').length,
        revenue: paid.length * (e.price ?? 0),
      };
    });
  }

  async searchUsers(term: string): Promise<AppUser[]> {
    await this.db.ensureLoaded();
    this.requireAdmin();
    const t = term.trim().toLowerCase();
    if (!t) return this.db.state().users.slice(0, 25);
    return this.db.state().users
      .filter((u) =>
        u.first_name.toLowerCase().includes(t)
        || u.last_name.toLowerCase().includes(t)
        || u.email.toLowerCase().includes(t))
      .slice(0, 25);
  }

  async setUserRole(userId: string, role: UserRole): Promise<AppUser> {
    await this.db.ensureLoaded();
    this.requireAdmin();
    let updated: AppUser | null = null;
    this.db.update((s) => ({
      ...s,
      users: s.users.map((u) => {
        if (u.id !== userId) return u;
        updated = { ...u, role };
        return updated;
      }),
    }));
    if (!updated) throw new Error('User not found.');
    return updated;
  }

  async auditLog(limit = 100): Promise<AuditLogEntry[]> {
    await this.db.ensureLoaded();
    this.requireAdmin();
    return this.db.state().auditLog
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  async finalizePastEvents(graceHours = 12): Promise<number> {
    await this.db.ensureLoaded();
    this.requireAdmin();
    const cutoff = Date.now() - graceHours * 3600 * 1000;
    const past = this.db.state().events.filter(
      (e) => new Date(e.event_date).getTime() < cutoff);
    let total = 0;
    for (const ev of past) {
      const before = this.db.state().registrations
        .filter((r) => r.event_id === ev.id && r.attendee_status === 'not_checked_in').length;
      if (before === 0 && ev.status === 'closed') continue;
      total += before;
      await this.db.patch({});
      // reuse the mock events service? simplest: inline the cancellation.
      const cancelledIds = new Set(
        this.db.state().registrations
          .filter((r) => r.event_id === ev.id && r.attendee_status === 'not_checked_in')
          .map((r) => r.id),
      );
      this.db.update((s) => ({
        ...s,
        registrations: s.registrations.map((r) =>
          cancelledIds.has(r.id) ? { ...r, attendee_status: 'cancelled' } : r),
        events: s.events.map((e) => e.id === ev.id
          ? { ...e, status: 'closed', closed_at: e.closed_at ?? new Date().toISOString() }
          : e),
      }));
    }
    return total;
  }
}