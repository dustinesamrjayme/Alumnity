import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../repositories/auth.service';
import { UserRole } from '../models';

export function roleGuard(...allowed: UserRole[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ready();
    const role = auth.currentRole();
    if (!role) return router.createUrlTree(['/login']);
    if (allowed.includes(role)) return true;
    const home = role === 'admin' ? '/admin/dashboard'
               : role === 'volunteer' ? '/volunteer/events'
               : '/tabs/events';
    return router.createUrlTree([home]);
  };
}