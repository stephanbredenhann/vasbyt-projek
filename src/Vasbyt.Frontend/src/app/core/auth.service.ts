import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { CurrentUser } from './api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  readonly user = signal<CurrentUser | null>(null);
  readonly isSignedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.roles.includes('Admin') ?? false);

  /** Called once at bootstrap: the auth cookie may already be valid from a previous visit. */
  refresh() {
    return this.api.me().pipe(
      tap((u) => this.user.set(u)),
      catchError(() => {
        this.user.set(null);
        return of(null);
      }),
    );
  }

  signIn(email: string, password: string) {
    return this.api.login(email, password).pipe(tap((u) => this.user.set(u)));
  }

  signOut() {
    return this.api.logout().pipe(tap(() => this.user.set(null)));
  }
}
