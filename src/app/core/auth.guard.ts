import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DemoStore } from './demo-store.service';

export const authGuard: CanActivateFn = () => {
  const store = inject(DemoStore);
  return store.session() ? true : inject(Router).createUrlTree(['/login']);
};
