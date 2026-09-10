import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminProduct, AdminVariant, ApiService, Deleted } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';
import { ImageField } from './image-field';

type VariantDraft = Omit<AdminVariant, 'id'> & { id?: number; error?: string };
type ProductDraft = Omit<AdminProduct, 'id' | 'variants'> & {
  id?: number;
  variants: VariantDraft[];
};

/** Products with their variants inline: the admin product list is the only variant list there is. */
@Component({
  selector: 'vb-admin-products',
  standalone: true,
  imports: [FormsModule, ImageField],
  template: `
    <h2>{{ i18n.t('admin.productsTitle') }}</h2>

    <div class="bar">
      <button class="btn btn--accent" type="button" (click)="add()">
        {{ i18n.t('admin.newProduct') }}
      </button>
      @if (notice(); as n) {
        <span class="chip chip--quiet">{{ n }}</span>
      }
    </div>

    @if (products().length) {
      @for (p of products(); track $index) {
        <article class="card product">
          <div class="product__grid">
            <div>
              <vb-image-field
                [url]="p.imageUrl"
                [alt]="p.name"
                (uploaded)="p.imageFileName = $event.fileName; p.imageUrl = $event.url"
              />
            </div>

            <div>
              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('admin.name') }}</span>
                  <input type="text" [(ngModel)]="p.name" />
                </label>
                <label class="field">
                  <span>{{ i18n.t('admin.sortOrder') }}</span>
                  <input type="number" [(ngModel)]="p.sortOrder" />
                </label>
              </div>
              <label class="field">
                <span>{{ i18n.t('admin.description') }}</span>
                <textarea [(ngModel)]="p.description"></textarea>
              </label>
              <label class="check">
                <input type="checkbox" [(ngModel)]="p.isActive" />
                <span>{{ i18n.t('admin.active') }}</span>
              </label>

              <div class="actions">
                <button class="btn btn--primary" type="button" (click)="save(p)">
                  {{ i18n.t('admin.save') }}
                </button>
                @if (p.id) {
                  <button class="btn btn--ghost" type="button" (click)="remove(p.id)">
                    {{ i18n.t('admin.delete') }}
                  </button>
                }
              </div>
              @if (p.error) {
                <p class="alert alert--error">{{ p.error }}</p>
              }
            </div>
          </div>

          @if (p.id; as productId) {
            <h3>{{ i18n.t('admin.variants') }}</h3>
            <div class="table-scroll">
              <table class="data">
                <thead>
                  <tr>
                    <th>{{ i18n.t('admin.label') }}</th>
                    <th>{{ i18n.t('admin.price') }}</th>
                    <th>{{ i18n.t('admin.active') }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of p.variants; track $index) {
                    <tr>
                      <td><input type="text" [(ngModel)]="v.label" /></td>
                      <td><input type="number" step="1" [(ngModel)]="v.priceZar" /></td>
                      <td><input type="checkbox" [(ngModel)]="v.isActive" /></td>
                      <td>
                        <div class="row-actions">
                          <button class="btn btn--ghost btn--sm" type="button" (click)="saveVariant(productId, v)">
                            {{ i18n.t('admin.save') }}
                          </button>
                          @if (v.id) {
                            <button class="btn btn--ghost btn--sm" type="button" (click)="removeVariant(productId, v.id)">
                              {{ i18n.t('admin.delete') }}
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                    @if (v.error) {
                      <tr>
                        <td colspan="4"><p class="alert alert--error">{{ v.error }}</p></td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            <button class="btn btn--ghost" type="button" (click)="addVariant(p)">
              {{ i18n.t('admin.newVariant') }}
            </button>
          }
        </article>
      }
    } @else {
      <p class="muted">{{ i18n.t('admin.noProducts') }}</p>
    }
  `,
  styles: `
    h2 {
      margin-bottom: var(--space-6);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      margin-bottom: var(--space-6);
    }

    .product {
      margin-bottom: var(--space-6);
    }

    .product__grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      gap: var(--space-8);
    }

    @media (max-width: 720px) {
      .product__grid {
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

    .check input,
    td input[type='checkbox'] {
      width: auto;
    }

    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    h3 {
      margin-top: var(--space-8);
    }

    td input {
      min-width: 6rem;
    }

    .row-actions {
      display: flex;
      gap: var(--space-2);
    }

    .btn--sm {
      padding: var(--space-2) var(--space-4);
      font-size: 0.8125rem;
    }
  `,
})
export class AdminProducts {
  protected readonly i18n = inject(I18nService);
  protected readonly products = signal<(ProductDraft & { error?: string })[]>([]);
  protected readonly notice = signal('');

  private api = inject(ApiService);

  constructor() {
    this.load();
  }

  protected add() {
    this.products.update((list) => [
      {
        name: '',
        description: '',
        imageFileName: null,
        imageUrl: null,
        sortOrder: list.length + 1,
        isActive: true,
        variants: [],
      },
      ...list,
    ]);
  }

  protected save(p: ProductDraft & { error?: string }) {
    p.error = undefined;
    this.api.adminSaveProduct(p).subscribe({
      next: () => this.load(),
      error: (e: { error?: { detail?: string } }) => {
        p.error = e.error?.detail ?? this.i18n.t('common.error');
        this.products.update((list) => [...list]);
      },
    });
  }

  protected remove(id: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteProduct(id).subscribe((r) => this.told(r));
  }

  protected addVariant(p: ProductDraft) {
    p.variants.push({ label: '', priceZar: 0, stock: 0, isActive: true });
    this.products.update((list) => [...list]);
  }

  /** An emptied number input hands back null, and null >= 0 is true, so demand a real number. */
  protected saveVariant(productId: number, v: VariantDraft) {
    v.error = !v.label?.trim()
      ? this.i18n.t('admin.labelRequired')
      : !(Number.isFinite(v.priceZar) && v.priceZar >= 0)
        ? this.i18n.t('admin.priceInvalid')
        : undefined;
    this.products.update((list) => [...list]);
    if (v.error) return;

    this.api.adminSaveVariant(productId, v).subscribe({
      next: () => this.load(),
      error: (e: { error?: { detail?: string } }) => {
        v.error = e.error?.detail ?? this.i18n.t('common.error');
        this.products.update((list) => [...list]);
      },
    });
  }

  protected removeVariant(productId: number, variantId: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteVariant(productId, variantId).subscribe((r) => this.told(r));
  }

  /** The endpoint decides between a real delete and a deactivation, so say which one happened. */
  private told(r: Deleted) {
    this.notice.set(this.i18n.t(r.hardDeleted ? 'admin.hardDeleted' : 'admin.softDeleted'));
    this.load();
  }

  private load() {
    this.api.adminProducts().subscribe((p) => this.products.set(p));
  }
}
