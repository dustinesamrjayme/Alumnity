import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

const shell = () => import('./components/shell.page').then((m) => m.ShellPage);

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },

  {
    path: 'tabs', loadComponent: shell, data: { kind: 'attendee' }, canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'events', pathMatch: 'full' },
      {
        path: 'events',
        children: [
          { path: '', loadComponent: () => import('./pages/attendee/events.page').then((m) => m.EventsPage) },
          { path: ':id', loadComponent: () => import('./pages/attendee/event-details.page').then((m) => m.EventDetailsPage) },
          { path: ':id/register', loadComponent: () => import('./pages/attendee/registration.page').then((m) => m.RegistrationPage) },
          { path: ':id/success/:ticketId', loadComponent: () => import('./pages/attendee/success.page').then((m) => m.SuccessPage) },
        ],
      },
      {
        path: 'tickets',
        children: [
          { path: '', loadComponent: () => import('./pages/attendee/tickets.page').then((m) => m.TicketsPage) },
          { path: ':ticketId', loadComponent: () => import('./pages/attendee/ticket.page').then((m) => m.TicketPage) },
        ],
      },
      { path: 'profile', loadComponent: () => import('./pages/attendee/profile.page').then((m) => m.ProfilePage) },
    ],
  },

  {
    path: 'admin', loadComponent: shell, data: { kind: 'admin' }, canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/dashboard.page').then((m) => m.DashboardPage) },
      {
        path: 'events',
        children: [
          { path: '', loadComponent: () => import('./pages/admin/admin-events.page').then((m) => m.AdminEventsPage) },
          { path: 'new', loadComponent: () => import('./pages/admin/create-event.page').then((m) => m.CreateEventPage) },
          { path: 'past', loadComponent: () => import('./pages/admin/past-events.page').then((m) => m.PastEventsPage) },
          { path: ':id/edit', loadComponent: () => import('./pages/admin/create-event.page').then((m) => m.CreateEventPage) },
        ],
      },
      {
        path: 'checkin',
        children: [
          { path: '', loadComponent: () => import('./pages/admin/checkin-events.page').then((m) => m.CheckinEventsPage) },
          { path: 'sync', loadComponent: () => import('./pages/admin/sync-status.page').then((m) => m.SyncStatusPage) },
          { path: ':id', loadComponent: () => import('./pages/admin/attendees.page').then((m) => m.AttendeesPage) },
          { path: ':id/scan', loadComponent: () => import('./pages/admin/scanner.page').then((m) => m.ScannerPage) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
