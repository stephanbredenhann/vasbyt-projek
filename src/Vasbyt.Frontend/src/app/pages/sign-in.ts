import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../i18n/i18n.service';

@Component({
  selector: 'vb-sign-in',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('auth.title') }}</h1>

      <form class="card sign-in" (ngSubmit)="submit()">
        @if (error()) {
          <p class="alert alert--error">{{ error() }}</p>
        }

        <label class="field">
          <span>{{ i18n.t('auth.email') }}</span>
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
        </label>

        <label class="field">
          <span>{{ i18n.t('auth.password') }}</span>
          <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
        </label>

        <button type="submit" class="btn btn--primary btn--block" [disabled]="busy()">
          {{ busy() ? i18n.t('common.loading') : i18n.t('auth.submit') }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .sign-in {
      max-width: 24rem;
    }
  `,
})
export class SignIn {
  protected readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit() {
    this.busy.set(true);
    this.error.set(null);
    this.auth.signIn(this.email(), this.password()).subscribe({
      next: (u) => this.router.navigate([u.roles.includes('Admin') ? '/admin' : '/rekening']),
      error: () => {
        this.busy.set(false);
        this.error.set(this.i18n.t('common.error'));
      },
    });
  }
}
