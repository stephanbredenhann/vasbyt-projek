import { Component, inject, signal } from '@angular/core';
import { concat, tap, toArray } from 'rxjs';
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

type Draft = ProductDraft & { error?: string; saving?: boolean };

/** After one save: the saved product takes the fresh copy, every other draft keeps its unsaved edits. */
export function mergeProducts<T extends { id?: number }>(current: T[], fresh: T[], savedId: number): T[] {
  const mine = new Map(current.filter((p) => p.id).map((p) => [p.id, p]));
  return [
    ...current.filter((p) => !p.id),
    ...fresh.map((p) => (p.id !== savedId && mine.get(p.id)) || p),
  ];
}

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

    @if (failed()) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
      <button type="button" class="btn btn--ghost" (click)="load()">{{ i18n.t('admin.retry') }}</button>
    } @else if (!loaded()) {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (products().length) {
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
              @if (!p.id) {
                <p class="muted hint">{{ i18n.t('admin.newProductHidden') }}</p>
              }
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
                <button class="btn btn--primary" type="button" (click)="save(p)" [disabled]="p.saving">
                  {{ i18n.t(p.saving ? 'entrant.saving' : p.multiple ? (p.id ? 'admin.saveProduct' : 'admin.saveProductAndVariants') : 'admin.saveProductAndPrice') }}
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

          @if (p.multiple) {
            <h3>{{ i18n.t('admin.variants') }}</h3>
            <p class="muted">{{ i18n.t('admin.quantityOnHandHint') }}</p>
            <div class="table-scroll">
              <table class="data data--stack">
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
                      <td class="primary"><input type="text" [(ngModel)]="v.label" [attr.aria-label]="vname(p, v, 'admin.label')" /></td>
                      <td [attr.data-label]="i18n.t('admin.price')"><input type="number" step="1" [(ngModel)]="v.priceZar" [attr.aria-label]="vname(p, v, 'admin.price')" /></td>
                      <td [attr.data-label]="i18n.t('admin.trackStock')"><input type="checkbox" [(ngModel)]="v.trackStock" [attr.aria-label]="vname(p, v, 'admin.trackStock')" /></td>
                      <td [attr.data-label]="i18n.t('admin.quantityOnHand')">
                        <div class="stock-cell">
                          <input type="number" min="0" step="1" [(ngModel)]="v.stock" [disabled]="!v.trackStock" [attr.aria-label]="vname(p, v, 'admin.quantityOnHand')" />
                          @if (v.trackStock && v.stock != null && v.stock <= 0) {
                            <span class="chip chip--quiet">{{ i18n.t('admin.soldOut') }}</span>
                          }
                        </div>
                      </td>
                      <td [attr.data-label]="i18n.t('admin.active')"><input type="checkbox" [(ngModel)]="v.isActive" [attr.aria-label]="vname(p, v, 'admin.active')" /></td>
                      <td class="actions-cell">
                        @if (p.id; as productId) {
                          @if (!p.saving) {
                          <div class="row-actions">
                            <button class="btn btn--ghost btn--sm" type="button" (click)="saveVariant(productId, v)"
                                    [attr.aria-label]="vname(p, v, 'admin.saveVariant')">
                              {{ i18n.t('admin.saveVariant') }}
                            </button>
                            @if (v.id) {
                              <button class="btn btn--ghost btn--sm" type="button" (click)="removeVariant(productId, v.id)">
                                {{ i18n.t('admin.delete') }}
                              </button>
                            } @else {
                              <button class="btn btn--ghost btn--sm" type="button" (click)="dropDraftVariant(p, v)"
                                      [attr.aria-label]="vname(p, v, 'admin.delete')">
                                {{ i18n.t('admin.delete') }}
                              </button>
                            }
                          </div>
                          }
                        } @else if (!v.id) {
                          <button class="btn btn--ghost btn--sm" type="button" (click)="dropDraftVariant(p, v)"
                                  [attr.aria-label]="vname(p, v, 'admin.delete')">
                            {{ i18n.t('admin.delete') }}
                          </button>
                        }
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
            @if (!p.id) {
              <p class="muted">{{ i18n.t('admin.variantsSaveWithProduct') }}</p>
            }
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

    @media (max-width: 559px) {
      td[data-label] {
        min-height: var(--touch);
        display: flex;
        align-items: center;
      }
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
  protected readonly products = signal<Draft[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
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
        isActive: false,
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
  protected save(p: Draft) {
    this.savedId.set(0);
    const single = p.multiple ? null : this.one(p);
    if (single) {
      single.stock = single.stock ?? 0;
      single.label = '';
      p.error = this.variantError(single, false);
      this.products.update((list) => [...list]);
      if (p.error) return;
    }
    const fresh = p.multiple && !p.id;
    const batch = fresh ? this.live(p) : [];
    if (fresh) {
      batch.forEach((v) => { v.stock = v.stock ?? 0; v.error = this.variantError(v, true); });
      this.products.update((list) => [...list]);
      if (batch.some((v) => v.error)) return;
    }
    p.error = undefined;
    p.saving = true;
    const failed = (e: { error?: { detail?: string } }) => {
      p.saving = false;
      p.error = e.error?.detail ?? this.i18n.t('common.error');
      this.products.update((list) => [...list]);
    };
    this.api.adminSaveProduct(p).subscribe({
      next: (saved) => {
        const id = p.id ?? saved.id;
        p.id = id;
        let sent = 0;
        const done = (error?: string, status?: number) => {
          this.savedId.set(error ? 0 : id ?? 0);
          // A failed save must not lose what the admin typed, except on a 409 where the typed values are stale.
          const restore = !error || status === 409 ? undefined : (s: Draft) => {
            if (single) Object.assign(this.one(s), { priceZar: single.priceZar, stock: single.stock, trackStock: single.trackStock });
            else if (batch.length) { s.multiple = true; s.variants = [...s.variants.filter((v) => v.id), ...batch.slice(sent).map((v) => ({ ...v, id: undefined }))]; }
          };
          this.refresh(id ?? 0, error, restore);
        };
        if (!id) return done();
        if (single) return this.api.adminSaveVariant(id, single).subscribe({ next: () => done(), error: (e) => done(e.error?.detail ?? this.i18n.t('common.error'), e.status) });
        if (!batch.length) return done();
        concat(...batch.map((v) => this.api.adminSaveVariant(id, v).pipe(tap(() => sent++)))).pipe(toArray())
          .subscribe({ next: () => done(), error: (e) => done(e.error?.detail ?? this.i18n.t('common.error'), e.status) });
      },
      error: failed,
    });
  }

  protected remove(id: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteProduct(id).subscribe((r) => this.told(r, id));
  }

  protected addVariant(p: ProductDraft) {
    p.variants.push(blankVariant());
    this.products.update((list) => [...list]);
  }

  protected dropDraftVariant(p: ProductDraft, v: VariantDraft) {
    p.variants.splice(p.variants.indexOf(v), 1);
    this.products.update((list) => [...list]);
  }

  /** An emptied number input hands back null, which counts as 0 on hand. */
  protected saveVariant(productId: number, v: VariantDraft) {
    v.stock = v.stock ?? 0;
    v.error = this.variantError(v, true);
    this.products.update((list) => [...list]);
    if (v.error) return;

    this.api.adminSaveVariant(productId, v).subscribe({
      next: () => this.refresh(productId),
      error: (e: { error?: { detail?: string } }) => {
        v.error = e.error?.detail ?? this.i18n.t('common.error');
        this.products.update((list) => [...list]);
      },
    });
  }

  protected removeVariant(productId: number, variantId: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteVariant(productId, variantId).subscribe((r) => this.told(r, productId));
  }

  /** Deactivated variants stay listed as history but no longer count as a choice. */
  protected live(p: ProductDraft) { return p.variants.filter((v) => v.isActive); }
  protected one(p: ProductDraft) { return this.live(p)[0]; }
  protected vname(p: ProductDraft, v: VariantDraft, key: Parameters<I18nService['t']>[0]) {
    return `${this.i18n.t(key)}: ${p.name} ${v.label}`;
  }

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
  private told(r: Deleted, keepId: number) {
    this.notice.set(this.i18n.t(r.hardDeleted ? 'admin.hardDeleted' : 'admin.softDeleted'));
    this.refresh(keepId);
  }

  private fetch(then: (list: Draft[]) => void, onError?: () => void) {
    // One unlabelled variant (or none yet) reads as a product sold without variants.
    this.api.adminProducts().subscribe({
      next: (list) => then(list.map((p) => {
        const live = p.variants.filter((v) => v.isActive);
        const multiple = live.length > 1 || live.some((v) => v.label.trim());
        return { ...p, multiple, variants: !multiple && !live.length ? [...p.variants, blankVariant()] : p.variants };
      })),
      error: onError,
    });
  }

  protected load() {
    this.failed.set(false);
    this.fetch((list) => { this.products.set(list); this.loaded.set(true); }, () => this.failed.set(true));
  }

  /** Refresh from the server without discarding the other products' unsaved edits. */
  private refresh(savedId: number, error?: string, restore?: (saved: Draft) => void) {
    this.fetch((fresh) => this.products.update((cur) => {
      const merged = mergeProducts(cur, fresh, savedId);
      const saved = merged.find((p) => p.id === savedId);
      if (saved) { saved.error = error; restore?.(saved); }
      return merged;
    }), () => this.products.update((cur) => {
      const stuck = cur.find((p) => p.id === savedId);
      if (stuck) { stuck.saving = false; stuck.error = error ?? this.i18n.t('common.error'); }
      return [...cur];
    }));
  }
}
