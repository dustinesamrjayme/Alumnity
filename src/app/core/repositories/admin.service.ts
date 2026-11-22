import { AppUser, AuditLogEntry, EventDashboardStats, UserRole } from '../models';
import {DepartmentUserStats} from '../../core/department-user-stats';
import { TotalAlumniGrowthPoint } from '../total-alumni-growth-point';

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

  abstract analyticsTrend(startDate?: string | null): Promise<RegistrationTrendPoint[]>;
  abstract analyticsByBatch(startDate?: string | null): Promise<BatchPoint[]>;
  abstract analyticsByDepartment(startDate?: string | null): Promise<DepartmentPoint[]>;
  abstract userCountsByDepartment(startDate?: string | null): Promise<DepartmentUserStats[]>;
  abstract refreshAnalytics(): Promise<void>;
  abstract totalAlumniGrowth(startDate?: string | null): Promise<TotalAlumniGrowthPoint[]>;
}