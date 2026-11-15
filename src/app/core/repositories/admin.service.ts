import { AppUser, AuditLogEntry, EventDashboardStats, UserRole } from '../models';


export interface RegistrationTrendPoint { year: number; month: number; registrations: number; revenue: number; }
export interface BatchPoint { batch: number; registrations: number; checked_in: number; }
export interface DepartmentPoint { department: string; program: string; registrations: number; checked_in: number; }

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

  abstract analyticsTrend(): Promise<RegistrationTrendPoint[]>;
  abstract analyticsByBatch(): Promise<BatchPoint[]>;
  abstract analyticsByDepartment(): Promise<DepartmentPoint[]>;
  abstract refreshAnalytics(): Promise<void>;
}