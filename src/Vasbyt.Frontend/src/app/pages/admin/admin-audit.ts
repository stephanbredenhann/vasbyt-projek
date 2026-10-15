import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditRow } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

/** Who changed what, newest first. Each row opens to the old and new value of every field it wrote. */
@Component({
  selector: 'vb-admin-audit',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <h2>{{ i18n.t('admin.auditTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.auditIntro') }}</p>

    <form class="card controls" (ngSubmit)="search()">
      <label class="field">
        <span>{{ i18n.t('admin.auditSearch') }}</span>
        <input type="search" name="q" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </label>
      <button class="btn btn--primary" type="submit">{{ i18n.t('admin.searchButton') }}</button>
    </form>

    @if (loaded() === null) {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (loaded() === false) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
      <button class="btn btn--ghost" type="button" (click)="load()">{{ i18n.t('admin.retry') }}</button>
    } @else if (rows().length) {
      <div class="card table-scroll">
        <table class="data data--stack">
          <thead>
            <tr>
              <th>{{ i18n.t('admin.auditWhen') }}</th>
              <th>{{ i18n.t('admin.auditWho') }}</th>
              <th>{{ i18n.t('admin.auditWhat') }}</th>
              <th>{{ i18n.t('admin.auditResult') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td class="primary">{{ r.createdUtc | date: 'yyyy-MM-dd HH:mm:ss' }}</td>
                <td [attr.data-label]="i18n.t('admin.auditWho')">{{ r.actorEmail }}</td>
                <td [attr.data-label]="i18n.t('admin.auditWhat')"><code>{{ r.method }} {{ short(r.path) }}</code></td>
                <td [attr.data-label]="i18n.t('admin.auditResult')">
                  <span class="chip" [class.chip--quiet]="r.statusCode < 400" [class.chip--accent]="r.statusCode >= 400">{{ r.statusCode }}</span>
                </td>
                <td class="actions-cell">
                  @if (r.changes.length) {
                    <button class="btn btn--ghost btn--sm" type="button" [attr.aria-expanded]="open() === r.id" (click)="open.set(open() === r.id ? 0 : r.id)">
                      {{ r.changes.length }} {{ i18n.t('admin.auditChanges') }}
                    </button>
                  }
                </td>
              </tr>
              @if (open() === r.id) {
                <tr>
                  <td colspan="5">
                    @for (c of r.changes; track $index) {
                      <p class="change"><strong>{{ c.entity }} {{ c.key }}</strong> <span class="chip chip--quiet">{{ c.state }}</span></p>
                      <dl class="fields">
                        @for (f of fieldsOf(c.fields); track f[0]) {
                          <dt>{{ f[0] }}</dt>
                          <dd><span class="old">{{ show(f[1][0]) }}</span> → {{ show(f[1][1]) }}</dd>
                        }
                      </dl>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button class="btn btn--ghost" type="button" [disabled]="page() === 1" (click)="go(-1)">{{ i18n.t('admin.prev') }}</button>
        <span class="muted">{{ i18n.t('admin.page') }} {{ page() }} · {{ total() }} {{ i18n.t('admin.rows') }}</span>
        <button class="btn btn--ghost" type="button" [disabled]="page() * size >= total()" (click)="go(1)">{{ i18n.t('admin.next') }}</button>
      </div>
    } @else {
      <p class="muted">{{ i18n.t(q().trim() ? 'admin.noMatches' : 'admin.auditEmpty') }}</p>
    }
  `,
  styles: `
    .controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-4); margin-bottom: var(--space-6); }
    .controls .field { margin-bottom: 0; min-width: min(20rem, 100%); }
    .controls .btn { min-height: var(--touch); }
    code { font-size: 0.875rem; overflow-wrap: anywhere; }
    .change { margin: var(--space-3) 0 var(--space-2); }
    .fields { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-1) var(--space-4); margin: 0; font-size: 0.9375rem; }
    .fields dt { font-weight: 600; }
    .fields dd { margin: 0; overflow-wrap: anywhere; }
    .old { color: var(--muted, inherit); text-decoration: line-through; }
    .actions-cell .btn { white-space: nowrap; }
    .pager { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-4); }
  `,
})
export class AdminAudit {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  protected readonly rows = signal<AuditRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly open = signal(0);
  protected readonly q = signal('');
  protected readonly loaded = signal<boolean | null>(null);
  protected readonly size = 50;
  private latest = 0;

  constructor() {
    this.load();
  }

  protected short(path: string) { return path.replace(/^\/api\/admin/, ''); }
  protected fieldsOf(fields: Record<string, [unknown, unknown]>) { return Object.entries(fields); }
  protected show(v: unknown) { return v === null || v === undefined ? '∅' : typeof v === 'string' ? v : JSON.stringify(v); }

  protected search() {
    this.page.set(1);
    this.load();
  }

  protected go(step: number) {
    this.page.update((p) => p + step);
    this.load();
  }

  protected load() {
    const id = ++this.latest;
    this.loaded.set(null);
    this.api.adminAudit(this.page(), this.size, this.q().trim()).subscribe({
      next: (r) => { if (id !== this.latest) return; this.rows.set(r.items); this.total.set(r.total); this.loaded.set(true); },
      error: () => { if (id === this.latest) this.loaded.set(false); },
    });
  }
}
