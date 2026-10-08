import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/**
 * Keeps someone from typing their way onto an entrant form before the order is paid. This mirrors
 * the server rule rather than replacing it — the API refuses the same request with a 403 regardless,
 * which is what actually enforces it. This guard only makes the refusal a redirect instead of an error.
 */
export const paidOrderGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const token = route.paramMap.get('token');
  if (!token) return router.createUrlTree(['/registreer']);

  return inject(ApiService)
    .order(token)
    .pipe(
      map((order) =>
        order.status === 'Paid' ? true : router.createUrlTree(['/bestel', token, 'betaal']),
      ),
      catchError(() => of(router.createUrlTree(['/registreer']))),
    );
};

export const authGuard: CanActivateFn = (_, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (auth.isSignedIn()) return true;
  return auth.refresh().pipe(map((u) => (u ? true : router.createUrlTree(['/teken-aan'], { queryParams: { terug: state.url } }))));
};

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const allow = () => (auth.isAdmin() ? true : router.createUrlTree(['/']));
  if (auth.isSignedIn()) return allow();
  return auth.refresh().pipe(map(allow));
};
