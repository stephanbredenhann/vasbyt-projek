import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { TranslationKey } from '../../i18n/af';
import { I18nService } from '../../i18n/i18n.service';

const RESULT: Record<string, TranslationKey> = {
  promoted: 'admin.adminPromoted',
  invited: 'admin.adminInvited',
  already: 'admin.adminAlready',
};

/** Promotes an existing account, or emails a signup link that makes the new account an admin. */
@Component({
  selector: 'vb-admin-admins',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>{{ i18n.t('admin.adminsTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.adminsIntro') }}</p>

    <form #f="ngForm" class="card add" (ngSubmit)="add(f)">
      <label class="field">
        <span>{{ i18n.t('admin.adminEmail') }}</span>
        <input type="email" name="email" [(ngModel)]="email" required autocomplete="off" />
      </label>
      <button class="btn btn--primary" type="submit" [disabled]="busy() || !email().trim()">
        {{ busy() ? i18n.t('common.loading') : i18n.t('admin.addAdmin') }}
      </button>
      @if (message()) { <p class="alert alert--ok" role="status">{{ message() }}</p> }
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
    </form>

    <h3>{{ i18n.t('admin.currentAdmins') }}</h3>
    <ul class="card list">
      @for (a of admins(); track a.email) {
        <li><strong>{{ a.firstName }} {{ a.lastName }}</strong> <span class="muted">{{ a.email }}</span></li>
      }
    </ul>
  `,
  styles: `
    h2 { margin-bottom: var(--space-4); }
    .add { max-width: 32rem; margin-bottom: var(--space-8); }
    .add .alert { margin: var(--space-4) 0 0; }
    .list { list-style: none; margin: 0; padding-block: var(--space-2); }
    .list li { display: flex; flex-wrap: wrap; gap: var(--space-3); padding-block: var(--space-3); }
    .list li + li { border-top: 1px solid var(--rule); }
  `,
})
export class AdminAdmins {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  protected readonly admins = signal<{ email: string; firstName: string; lastName: string }[]>([]);
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  constructor() {
    this.load();
  }

  protected add(f: NgForm) {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    this.api.adminAddAdmin(this.email().trim()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.message.set(this.i18n.t(RESULT[r.status]));
        f.resetForm();
        this.email.set('');
        this.load();
      },
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }

  private load() {
    this.api.adminAdmins().subscribe((a) => this.admins.set(a));
  }
}
