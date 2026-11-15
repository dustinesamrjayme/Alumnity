import { Injectable, inject } from '@angular/core';
import { MockDatabase } from './mock-database.service';
import { AdminService, AlumniSummary } from '../admin.service';
import { AppUser, AuditLogEntry, EventDashboardStats, UserRole } from '../../models';
import { RegistrationTrendPoint, BatchPoint, DepartmentPoint } from '../admin.service';

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

  async alumniSummary(): Promise<AlumniSummary> {
    await this.db.ensureLoaded();
    this.requireAdmin();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
   const members = this.db.state().users.filter((u) => u.role === 'alumni');
    const newThisMonth = members.filter((u) => {
      const created = (u as unknown as { created_at?: string }).created_at;
      return created ? new Date(created) >= monthStart : false;
    }).length;
    return { total: members.length, newThisMonth };
  }

  private guardAdmin() { if (this.db.currentRole() !== 'admin') throw new Error('Not allowed.'); }

  async analyticsTrend(): Promise<RegistrationTrendPoint[]> {
    this.guardAdmin();
    return [
      { year: 2026, month: 6,  registrations: 12, revenue: 3600 },
      { year: 2026, month: 7,  registrations: 20, revenue: 6000 },
      { year: 2026, month: 8,  registrations: 9,  revenue: 2700 },
      { year: 2026, month: 9,  registrations: 31, revenue: 9300 },
      { year: 2026, month: 10, registrations: 24, revenue: 7200 },
      { year: 2026, month: 11, registrations: 15, revenue: 4500 },
    ];
  }
  async analyticsByBatch(): Promise<BatchPoint[]> {
    this.guardAdmin();
    return [
      { batch: 2010, registrations: 14, checked_in: 11 },
      { batch: 2016, registrations: 22, checked_in: 15 },
      { batch: 2020, registrations: 31, checked_in: 18 },
      { batch: 2024, registrations: 18, checked_in: 12 },
    ];
  }
  async analyticsByDepartment(): Promise<DepartmentPoint[]> {
    this.guardAdmin();
    return [
      { department: 'CEIT', program: 'BSIT', registrations: 30, checked_in: 21 },
      { department: 'CEIT', program: 'BSCE', registrations: 8,  checked_in: 5 },
      { department: 'CABA', program: 'BSA',  registrations: 19, checked_in: 12 },
      { department: 'COED', program: 'BECED', registrations: 16, checked_in: 10 },
      { department: 'CAS',  program: 'BSSW', registrations: 12, checked_in: 8 },
    ];
  }
  async refreshAnalytics(): Promise<void> { this.guardAdmin(); }
}