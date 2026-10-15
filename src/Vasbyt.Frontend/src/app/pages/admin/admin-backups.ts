import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Backup } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

/** Nightly pg_dump files kept on the server, plus one on demand. Downloads are in the audit log. */
@Component({
  selector: 'vb-admin-backups',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
    <h2>{{ i18n.t('admin.backupsTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.backupsIntro') }}</p>

    <div class="card make">
      <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="make()">
        {{ busy() ? i18n.t('admin.backupBusy') : i18n.t('admin.backupNow') }}
      </button>
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
    </div>

    @if (backups() === null) {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (backups()!.length) {
      <ul class="card list">
        @for (b of backups(); track b.name) {
          <li>
            <strong>{{ b.createdUtc | date: 'yyyy-MM-dd HH:mm' }}</strong>
            <span class="muted">{{ b.sizeBytes / 1048576 | number: '1.1-1' }} MB</span>
            <a class="btn btn--ghost btn--sm" [href]="'/api/admin/backups/' + b.name" [attr.download]="b.name">{{ i18n.t('admin.backupDownload') }}</a>
          </li>
        }
      </ul>
    } @else {
      <p class="muted">{{ i18n.t('admin.backupsEmpty') }}</p>
    }
  `,
  styles: `
    .make { margin-bottom: var(--space-6); }
    .make .alert { margin: var(--space-4) 0 0; }
    .list { list-style: none; margin: 0; padding-block: var(--space-2); }
    .list li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding-block: var(--space-3); }
    .list li + li { border-top: 1px solid var(--rule); }
    .list .btn { margin-left: auto; }
  `,
})
export class AdminBackups {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  protected readonly backups = signal<Backup[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    this.load();
  }

  protected make() {
    this.busy.set(true);
    this.error.set('');
    this.api.adminMakeBackup().subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }

  private load() {
    this.api.adminBackups().subscribe({ next: (b) => this.backups.set(b), error: () => { this.backups.set([]); this.error.set(this.i18n.t('admin.loadError')); } });
  }
}
