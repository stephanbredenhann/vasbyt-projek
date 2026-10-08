import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdvertKind } from '../../core/api.models';
import { AdminAdvert, ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';
import { ImageField } from './image-field';

type AdvertDraft = Omit<AdminAdvert, 'id'> & { id?: number; error?: string };

/** Accommodation and sponsors on one screen. An image is required, the booking link is not. */
@Component({
  selector: 'vb-admin-adverts',
  standalone: true,
  imports: [FormsModule, ImageField],
  template: `
    <h2>{{ i18n.t('admin.advertsTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.advertsIntro') }}</p>

    <div class="bar">
      <div class="chips">
        <button class="chip" type="button" [attr.aria-selected]="!filter()" (click)="filter.set('')">
          {{ i18n.t('admin.allKinds') }}
        </button>
        <button
          class="chip"
          type="button"
          [attr.aria-selected]="filter() === 'Accommodation'"
          (click)="filter.set('Accommodation')"
        >
          {{ i18n.t('admin.accommodation') }}
        </button>
        <button
          class="chip"
          type="button"
          [attr.aria-selected]="filter() === 'Sponsor'"
          (click)="filter.set('Sponsor')"
        >
          {{ i18n.t('admin.sponsor') }}
        </button>
      </div>

      <button class="btn btn--accent" type="button" (click)="add()">
        {{ i18n.t('admin.newAdvert') }}
      </button>
      @if (notice(); as n) {
        <span class="chip chip--quiet">{{ n }}</span>
      }
    </div>

    @if (visible().length) {
      @for (a of visible(); track $index) {
        <article class="card advert">
          <div class="advert__grid">
            <div>
              <vb-image-field
                [url]="a.imageUrl"
                [alt]="a.name"
                [ratio]="a.kind === 'Sponsor' ? 3 / 2 : 4 / 3"
                [fit]="a.kind === 'Sponsor' ? 'contain' : 'cover'"
                (uploaded)="a.imageFileName = $event.fileName; a.imageUrl = $event.url"
              />
              @if (!a.imageFileName) {
                <p class="field__error">{{ i18n.t('admin.imageRequired') }}</p>
              }
            </div>

            <div>
              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('admin.kind') }}</span>
                  <select [(ngModel)]="a.kind">
                    <option value="Accommodation">{{ i18n.t('admin.accommodation') }}</option>
                    <option value="Sponsor">{{ i18n.t('admin.sponsor') }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>{{ i18n.t('admin.name') }}</span>
                  <input type="text" [(ngModel)]="a.name" />
                </label>
                <label class="field">
                  <span>{{ i18n.t('admin.sortOrder') }}</span>
                  <input type="number" [(ngModel)]="a.sortOrder" />
                </label>
              </div>

              <label class="field">
                <span>{{ i18n.t('admin.blurb') }}</span>
                <textarea [(ngModel)]="a.blurb"></textarea>
              </label>

              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('admin.linkUrl') }}</span>
                  <input type="text" [(ngModel)]="a.linkUrl" />
                </label>
                <label class="field">
                  <span>{{ i18n.t('admin.bookingUrl') }} ({{ i18n.t('common.optional') }})</span>
                  <input type="text" [(ngModel)]="a.bookingUrl" />
                </label>
                <label class="field">
                  <span>{{ i18n.t('admin.phone') }} ({{ i18n.t('common.optional') }})</span>
                  <input type="tel" [(ngModel)]="a.phone" />
                </label>
              </div>

              <label class="check">
                <input type="checkbox" [(ngModel)]="a.isActive" />
                <span>{{ i18n.t('admin.active') }}</span>
              </label>

              <div class="actions">
                <button
                  class="btn btn--primary"
                  type="button"
                  [disabled]="!a.imageFileName"
                  (click)="save(a)"
                >
                  {{ i18n.t('admin.save') }}
                </button>
                @if (a.id) {
                  <button class="btn btn--ghost" type="button" (click)="remove(a.id)">
                    {{ i18n.t('admin.delete') }}
                  </button>
                }
              </div>
              @if (a.error) {
                <p class="alert alert--error">{{ a.error }}</p>
              }
            </div>
          </div>
        </article>
      }
    } @else {
      <p class="muted">{{ i18n.t('admin.noAdverts') }}</p>
    }
  `,
  styles: `
    h2 {
      margin-bottom: var(--space-4);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      margin-bottom: var(--space-6);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .advert {
      margin-bottom: var(--space-6);
    }

    .advert__grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      gap: var(--space-8);
    }

    @media (max-width: 720px) {
      .advert__grid {
        grid-template-columns: 1fr;
      }
    }

    .check {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.9375rem;
      margin-bottom: var(--space-4);
    }


    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
  `,
})
export class AdminAdverts {
  protected readonly i18n = inject(I18nService);
  protected readonly adverts = signal<AdvertDraft[]>([]);
  protected readonly filter = signal<AdvertKind | ''>('');
  protected readonly notice = signal('');

  protected readonly visible = computed(() => {
    const kind = this.filter();
    return kind ? this.adverts().filter((a) => a.kind === kind) : this.adverts();
  });

  private api = inject(ApiService);

  constructor() {
    this.load();
  }

  protected add() {
    this.adverts.update((list) => [
      {
        kind: this.filter() || 'Accommodation',
        name: '',
        blurb: '',
        imageFileName: null,
        imageUrl: null,
        linkUrl: null,
        bookingUrl: null,
        phone: null,
        sortOrder: list.length + 1,
        isActive: true,
      },
      ...list,
    ]);
  }

  protected save(a: AdvertDraft) {
    a.error = undefined;
    this.api.adminSaveAdvert(a).subscribe({
      next: () => this.load(),
      error: (e: { error?: { detail?: string } }) => {
        a.error = e.error?.detail ?? this.i18n.t('common.error');
        this.adverts.update((list) => [...list]);
      },
    });
  }

  /** Nothing in the schema points at an advert, so this one always really goes. */
  protected remove(id: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteAdvert(id).subscribe((r) => {
      this.notice.set(this.i18n.t(r.hardDeleted ? 'admin.hardDeleted' : 'admin.softDeleted'));
      this.load();
    });
  }

  private load() {
    this.api.adminAdverts().subscribe((a) => this.adverts.set(a));
  }
}
