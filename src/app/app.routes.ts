import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

const shell = () => import('./components/shell.page').then((m) => m.ShellPage);
const profile = () => import('./pages/shared/profile/profile.page').then((m) => m.ProfilePage);
const syncStatus = () => import('./components/sync-status.page').then((m) => m.SyncStatusPage);

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup.page').then((m) => m.SignUpPage) },
  { path: 'check-email', loadComponent: () => import('./pages/check-email/check-email.page').then((m) => m.CheckEmailPage) },
  {
    path: 'tabs', loadComponent: shell, data: { kind: 'attendee' }, canActivate: [roleGuard('alumni')],
    children: [
      { path: '', redirectTo: 'events', pathMatch: 'full' },
      { path: 'events', children: [
        { path: '', loadComponent: () => import('./pages/alumni/events/events.page').then((m) => m.EventsPage) },
        { path: ':id', loadComponent: () => import('./pages/alumni/event-details/event-details.page').then((m) => m.EventDetailsPage) },
        { path: ':id/register', loadComponent: () => import('./pages/alumni/registration/registration.page').then((m) => m.RegistrationPage) },
        { path: ':id/success/:ticketId', loadComponent: () => import('./pages/alumni/success/success.page').then((m) => m.SuccessPage) },
      ]},
      { path: 'tickets', children: [
        { path: '', loadComponent: () => import('./pages/alumni/tickets/tickets.page').then((m) => m.TicketsPage) },
        { path: ':ticketId', loadComponent: () => import('./pages/alumni/ticket/ticket.page').then((m) => m.TicketPage) },
      ]},
      { path: 'profile', loadComponent: profile },
    ],
  },

  {
    path: 'admin', loadComponent: shell, data: { kind: 'admin' }, canActivate: [roleGuard('admin')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'events', children: [
        { path: '', loadComponent: () => import('./pages/admin/admin-events/admin-events.page').then((m) => m.AdminEventsPage) },
        { path: 'new', loadComponent: () => import('./pages/admin/create-event/create-event.page').then((m) => m.CreateEventPage) },
        { path: 'past', loadComponent: () => import('./pages/admin/past-events/past-events.page').then((m) => m.PastEventsPage) },
        { path: ':id/edit', loadComponent: () => import('./pages/admin/create-event/create-event.page').then((m) => m.CreateEventPage) },
      ]},
      { path: 'attendees', children: [
        { path: '', loadComponent: () => import('./pages/admin/attendee-list/attendees-list.page').then((m) => m.AttendeesListPage) },
        { path: 'sync', loadComponent: syncStatus },
        { path: ':id', loadComponent: () => import('./pages/admin/attendees/attendee.page').then((m) => m.AttendeesPage) },
      ]},
      { path: 'profile', loadComponent: profile },
    ],
  },

  {
    path: 'volunteer', loadComponent: shell, data: { kind: 'volunteer' }, canActivate: [roleGuard('volunteer')],
    children: [
      { path: '', redirectTo: 'events', pathMatch: 'full' },
      { path: 'events', loadComponent: () => import('./pages/volunteer/events/events.page').then((m) => m.VolunteerEventsPage) },
      { path: 'scanner/:id', loadComponent: () => import('./pages/volunteer/scanner/scanner.page').then((m) => m.VolunteerScannerPage) },
      { path: 'attendees/:id', loadComponent: () => import('./pages/volunteer/attendees/attendees.page').then((m) => m.VolunteerAttendeesPage) },
      { path: 'sync', loadComponent: syncStatus },
      { path: 'profile', loadComponent: profile },
    ],
  },

  { path: '**', redirectTo: 'login' },
];