import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminProduct, AdminVariant, ApiService, Deleted } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';
import { ImageField } from './image-field';

type VariantDraft = Omit<AdminVariant, 'id'> & { id?: number; error?: string };
type ProductDraft = Omit<AdminProduct, 'id' | 'variants'> & {
  id?: number;
  variants: VariantDraft[];
  /** Off: the product is sold as one thing, stored as a single unlabelled variant. */
  multiple: boolean;
};

const blankVariant = (): VariantDraft => ({ label: '', priceZar: 0, stock: 0, isActive: true, trackStock: false, version: 0 });

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
              <label class="check toggle">
                <input type="checkbox" role="switch" [(ngModel)]="p.multiple" (ngModelChange)="toggled(p)"
                       [disabled]="p.multiple && live(p).length > 1" />
                <span>{{ i18n.t('admin.hasVariants') }}</span>
              </label>
              <p class="muted hint">
                {{ i18n.t(p.multiple && live(p).length > 1 ? 'admin.hasVariantsLocked' : 'admin.hasVariantsHint') }}
              </p>

              @if (!p.multiple) {
                @let v = one(p);
                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('admin.price') }}</span>
                    <input type="number" min="0" step="1" [(ngModel)]="v.priceZar" />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('admin.quantityOnHand') }}</span>
                    <input type="number" min="0" step="1" [(ngModel)]="v.stock" [disabled]="!v.trackStock" />
                  </label>
                </div>
                <label class="check">
                  <input type="checkbox" [(ngModel)]="v.trackStock" />
                  <span>{{ i18n.t('admin.trackStock') }}</span>
                  @if (v.trackStock && v.stock != null && v.stock <= 0) {
                    <span class="chip chip--quiet">{{ i18n.t('admin.soldOut') }}</span>
                  }
                </label>
                <p class="muted hint">{{ i18n.t('admin.quantityOnHandHint') }}</p>
              }

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
              @if (p.id && savedId() === p.id) { <p class="alert alert--ok" role="status">{{ i18n.t('admin.saved') }}</p> }
            </div>
          </div>

          @if (p.multiple && p.id; as productId) {
            <h3>{{ i18n.t('admin.variants') }}</h3>
            <p class="muted">{{ i18n.t('admin.quantityOnHandHint') }}</p>
            <div class="table-scroll">
              <table class="data">
                <thead>
                  <tr>
                    <th>{{ i18n.t('admin.label') }}</th>
                    <th>{{ i18n.t('admin.price') }}</th>
                    <th>{{ i18n.t('admin.trackStock') }}</th>
                    <th>{{ i18n.t('admin.quantityOnHand') }}</th>
                    <th>{{ i18n.t('admin.active') }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of p.variants; track $index) {
                    <tr>
                      <td><input type="text" [(ngModel)]="v.label" /></td>
                      <td><input type="number" step="1" [(ngModel)]="v.priceZar" /></td>
                      <td><input type="checkbox" [(ngModel)]="v.trackStock" [attr.aria-label]="i18n.t('admin.trackStock')" /></td>
                      <td>
                        <div class="stock-cell">
                          <input type="number" min="0" step="1" [(ngModel)]="v.stock" [disabled]="!v.trackStock" [attr.aria-label]="i18n.t('admin.quantityOnHand')" />
                          @if (v.trackStock && v.stock != null && v.stock <= 0) {
                            <span class="chip chip--quiet">{{ i18n.t('admin.soldOut') }}</span>
                          }
                        </div>
                      </td>
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
                        <td colspan="6"><p class="alert alert--error">{{ v.error }}</p></td>
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

    .hint {
      margin: calc(-1 * var(--space-2)) 0 var(--space-4);
      font-size: 0.9375rem;
    }

    /* A checkbox drawn as a switch: still a native input, so keyboard and screen readers come free. */
    .toggle input {
      appearance: none;
      flex: none;
      width: 2.75rem;
      height: 1.5rem;
      margin: 0;
      border-radius: var(--r-pill);
      background: var(--field-line);
      position: relative;
      cursor: pointer;
      transition: background-color var(--dur-ui) var(--ease-out);
    }
    .toggle input::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: calc(1.5rem - 6px);
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--paper);
      transition: translate var(--dur-ui) var(--ease-out);
    }
    .toggle input:checked { background: var(--indigo); }
    .toggle input:checked::after { translate: 1.25rem 0; }
    .toggle input:disabled { opacity: .5; cursor: not-allowed; }

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

    .stock-cell {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
  `,
})
export class AdminProducts {
  protected readonly i18n = inject(I18nService);
  protected readonly products = signal<(ProductDraft & { error?: string })[]>([]);
  protected readonly notice = signal('');
  protected readonly savedId = signal(0);

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
        variants: [blankVariant()],
        multiple: false,
      },
      ...list,
    ]);
  }

  /** Switching to a single product needs one variant to carry the price, so make one if none exists. */
  protected toggled(p: ProductDraft) {
    if (!p.multiple && !this.live(p).length) p.variants.push(blankVariant());
    this.products.update((list) => [...list]);
  }

  /** A single product saves its price and stock with the product, so one button does both. */
  protected save(p: ProductDraft & { error?: string }) {
    this.savedId.set(0);
    const single = p.multiple ? null : this.one(p);
    if (single) {
      single.stock = single.stock ?? 0;
      single.label = '';
      p.error = this.variantError(single, false);
      this.products.update((list) => [...list]);
      if (p.error) return;
    }
    p.error = undefined;
    const failed = (e: { error?: { detail?: string } }) => {
      p.error = e.error?.detail ?? this.i18n.t('common.error');
      this.products.update((list) => [...list]);
    };
    this.api.adminSaveProduct(p).subscribe({
      next: (saved) => {
        const id = p.id ?? saved.id;
        const done = () => { this.savedId.set(id ?? 0); this.load(); };
        if (!single || !id) return done();
        this.api.adminSaveVariant(id, single).subscribe({ next: done, error: failed });
      },
      error: failed,
    });
  }

  protected remove(id: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteProduct(id).subscribe((r) => this.told(r));
  }

  protected addVariant(p: ProductDraft) {
    p.variants.push(blankVariant());
    this.products.update((list) => [...list]);
  }

  /** An emptied number input hands back null, which counts as 0 on hand. */
  protected saveVariant(productId: number, v: VariantDraft) {
    v.stock = v.stock ?? 0;
    v.error = this.variantError(v, true);
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

  /** Deactivated variants stay listed as history but no longer count as a choice. */
  protected live(p: ProductDraft) { return p.variants.filter((v) => v.isActive); }
  protected one(p: ProductDraft) { return this.live(p)[0]; }

  private variantError(v: VariantDraft, needsLabel: boolean) {
    return needsLabel && !v.label?.trim()
      ? this.i18n.t('admin.labelRequired')
      : !(Number.isFinite(v.priceZar) && v.priceZar >= 0)
        ? this.i18n.t('admin.priceInvalid')
        : !(Number.isInteger(v.stock) && v.stock >= 0)
          ? this.i18n.t('admin.stockInvalid')
          : undefined;
  }

  /** The endpoint decides between a real delete and a deactivation, so say which one happened. */
  private told(r: Deleted) {
    this.notice.set(this.i18n.t(r.hardDeleted ? 'admin.hardDeleted' : 'admin.softDeleted'));
    this.load();
  }

  private load() {
    // One unlabelled variant (or none yet) reads as a product sold without variants.
    this.api.adminProducts().subscribe((list) => this.products.set(list.map((p) => {
      const live = p.variants.filter((v) => v.isActive);
      const multiple = live.length > 1 || live.some((v) => v.label.trim());
      return { ...p, multiple, variants: !multiple && !live.length ? [...p.variants, blankVariant()] : p.variants };
    })));
  }
}
