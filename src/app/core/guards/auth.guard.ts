import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../repositories/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.ready();
  return auth.currentUser() ? true : inject(Router).createUrlTree(['/login']);
};