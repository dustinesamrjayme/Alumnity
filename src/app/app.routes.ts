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
          { path: '', loadComponent: () => import('./pages/attendee/events/events.page').then((m) => m.EventsPage) },
          { path: ':id', loadComponent: () => import('./pages/attendee/event-details/event-details.page').then((m) => m.EventDetailsPage) },
          { path: ':id/register', loadComponent: () => import('./pages/attendee/registration/registration.page').then((m) => m.RegistrationPage) },
          { path: ':id/success/:ticketId', loadComponent: () => import('./pages/attendee/success/success.page').then((m) => m.SuccessPage) },
        ],
      },
      {
        path: 'tickets',
        children: [
          { path: '', loadComponent: () => import('./pages/attendee/tickets/tickets.page').then((m) => m.TicketsPage) },
          { path: ':ticketId', loadComponent: () => import('./pages/attendee/ticket/ticket.page').then((m) => m.TicketPage) },
        ],
      },
      { path: 'profile', loadComponent: () => import('./pages/attendee/profile/profile.page').then((m) => m.ProfilePage) },
    ],
  },

  {
    path: 'admin', loadComponent: shell, data: { kind: 'admin' }, canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      {
        path: 'events',
        children: [
          { path: '', loadComponent: () => import('./pages/admin/admin-events/admin-events.page').then((m) => m.AdminEventsPage) },
          { path: 'new', loadComponent: () => import('./pages/admin/create-event/create-event.page').then((m) => m.CreateEventPage) },
          { path: 'past', loadComponent: () => import('./pages/admin/past-events/past-events.page').then((m) => m.PastEventsPage) },
          { path: ':id/edit', loadComponent: () => import('./pages/admin/create-event/create-event.page').then((m) => m.CreateEventPage) },
        ],
      },
      {
        path: 'checkin',
        children: [
          { path: '', loadComponent: () => import('./pages/admin/checkin-events/checkin-events.page').then((m) => m.CheckinEventsPage) },
          { path: 'sync', loadComponent: () => import('./pages/admin/sync-status/sync-status.page').then((m) => m.SyncStatusPage) },
          { path: ':id', loadComponent: () => import('./pages/admin/attendees/attendees.page').then((m) => m.AttendeesPage) },
          { path: ':id/scan', loadComponent: () => import('./pages/admin/scanner/scanner.page').then((m) => m.ScannerPage) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
