import { AppUser, AuditLogEntry, EventDashboardStats, UserRole } from '../models';

export interface AlumniSummary {
  total: number;
  newThisMonth: number;
}

export abstract class AdminService {
  abstract dashboard(): Promise<EventDashboardStats[]>;
  abstract searchUsers(term: string): Promise<AppUser[]>;
  abstract setUserRole(userId: string, role: UserRole): Promise<AppUser>;
  abstract auditLog(limit?: number): Promise<AuditLogEntry[]>;
  abstract finalizePastEvents(graceHours?: number): Promise<number>;
  abstract alumniSummary(): Promise<AlumniSummary>;
}