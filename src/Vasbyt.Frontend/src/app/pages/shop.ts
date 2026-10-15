import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { ProductChooser } from '../shared/product-chooser';

/** The standalone shop. Same basket as the entry flow, so nothing here needs a ticket. */
@Component({
  selector: 'vb-shop',
  standalone: true,
  imports: [RouterLink, ProductChooser],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('shop.title') }}</h1>
      <p class="lead">{{ i18n.t('shop.intro') }}</p>
      <p class="muted">{{ i18n.t('shop.collectNote') }}</p>
      <p><button type="button" class="btn btn--ghost" (click)="dlg.showModal()">{{ i18n.t('shop.sizeGuide') }}</button></p>
      <vb-product-chooser />
      @if (!flow.ticketCount()) {
        <p class="muted">{{ i18n.t('shop.enterToo') }} <a routerLink="/registreer">{{ i18n.t('shop.enterLink') }}</a></p>
      }
    </div>

    <dialog #dlg class="sheet" aria-labelledby="size-guide-title" (click)="dismiss($event)">
      <div class="sheet__body">
        <button type="button" class="sheet__x" [attr.aria-label]="i18n.t('reg.close')" (click)="dlg.close()">×</button>
        <h2 id="size-guide-title">{{ i18n.t('shop.sizeGuide') }}</h2>

        <div class="tabs" role="tablist">
          <button type="button" role="tab" class="chip" [attr.aria-selected]="sizeTab() === 'shirts'"
                  (click)="sizeTab.set('shirts')">{{ i18n.t('shop.sizeShirts') }}</button>
          <button type="button" role="tab" class="chip" [attr.aria-selected]="sizeTab() === 'hats'"
                  (click)="sizeTab.set('hats')">{{ i18n.t('shop.sizeHats') }}</button>
        </div>

        @if (sizeTab() === 'shirts') {
          <p class="muted">{{ i18n.t('shop.sizeShirtSpec') }}</p>
          <svg class="figure" viewBox="0 0 200 150" aria-hidden="true">
            <path d="M72 8 Q100 28 128 8 L168 22 L196 58 L166 74 L154 58 L154 144 L46 144 L46 58 L34 74 L4 58 L32 22 Z" />
            <line x1="52" y1="66" x2="148" y2="66" />
            <path class="tip" d="M52 66 l8 -5 v10 Z M148 66 l-8 -5 v10 Z" />
          </svg>
          <p class="muted">{{ i18n.t('shop.sizeHowTo') }}</p>
          <table class="data">
            <thead><tr><th>{{ i18n.t('shop.size') }}</th><th>{{ i18n.t('shop.sizeHalfChest') }}</th></tr></thead>
            <tbody>
              @for (s of shirtSizes; track s[0]) {
                <tr><td>{{ s[0] }}</td><td class="num">{{ s[1] }}</td></tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="muted">{{ i18n.t('shop.sizeHatSpec') }}</p>
          <svg class="figure" viewBox="0 0 200 150" aria-hidden="true">
            <path d="M62 24 Q100 10 138 24 L150 92 Q100 104 50 92 Z M50 92 Q100 104 150 92 L194 124 Q100 146 6 124 Z" />
            <path class="arc" d="M58 80 Q100 94 142 80" />
            <path class="tip" d="M54 79 l9 -3 l-2 9 Z M146 79 l-9 -3 l2 9 Z" />
          </svg>
          <p class="muted">{{ i18n.t('shop.sizeHatHowTo') }}</p>
          <table class="data">
            <thead><tr><th>{{ i18n.t('shop.size') }}</th><th>{{ i18n.t('shop.sizeHead') }}</th></tr></thead>
            <tbody>
              @for (s of hatSizes; track s[0]) {
                <tr><td>{{ s[0] }}</td><td class="num">{{ s[1] }}</td></tr>
              }
            </tbody>
          </table>
        }

        <button type="button" class="btn btn--primary btn--block" (click)="dlg.close()">{{ i18n.t('reg.close') }}</button>
      </div>
    </dialog>
  `,
  styles: `
    .sheet {
      width: min(30rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); padding: 0; border: 0;
      border-radius: var(--r-lg); background: var(--paper); color: var(--ink); box-shadow: var(--shadow-3); overflow: hidden;
    }
    .sheet::backdrop { background: rgb(29 30 88 / 45%); }
    .sheet[open] { animation: sheet-in var(--dur-panel) var(--ease-out); }
    @media (prefers-reduced-motion: reduce) { .sheet[open] { animation: none; } }
    @keyframes sheet-in { from { opacity: 0; transform: translateY(0.75rem); } }
    .sheet__body { position: relative; max-height: calc(100dvh - 2rem); overflow: auto; scrollbar-width: thin; padding: var(--space-6); }
    .sheet__x {
      position: absolute; top: var(--space-4); right: var(--space-4); width: 2.25rem; height: 2.25rem;
      border: 0; border-radius: var(--r-pill); background: var(--karoo-sand-light); box-shadow: inset 0 0 0 1px var(--field-line);
      color: var(--ink); font-size: 1.5rem; line-height: 1; cursor: pointer;
      transition: background-color var(--dur-ui) var(--ease-out), color var(--dur-ui) var(--ease-out);
    }
    .sheet__x:hover { background: var(--indigo); color: var(--paper); }
    .sheet h2 { font-size: 1.5rem; margin: 0 var(--space-12) var(--space-4) 0; }
    .tabs { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0 0 var(--space-4); }
    .tabs .chip[aria-selected='true'] { background: var(--indigo); color: var(--paper); }
    .figure { display: block; width: 11rem; margin: var(--space-4) auto; }
    .figure > path:first-child { fill: var(--karoo-sand-light); stroke: var(--karoo-stone); stroke-width: 2; stroke-linejoin: round; }
    .figure line, .figure .arc { fill: none; stroke: var(--indigo); stroke-width: 2.5; }
    .figure .tip { fill: var(--indigo); }
    .data { margin: var(--space-4) 0 var(--space-6); }
    .num { font-variant-numeric: tabular-nums; }
  `,
})
export class Shop {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly shirtSizes = [
    ['XS', 47], ['S', 50], ['M', 53], ['L', 57], ['XL', 61], ['2XL', 65], ['3XL', 69], ['4XL', 73], ['5XL', 77],
  ] as const;

  protected readonly hatSizes = [['S/M', 56], ['L/XL', 59]] as const;
  protected readonly sizeTab = signal<'shirts' | 'hats'>('shirts');

  /** A click on the dialog element itself landed on the backdrop. */
  protected dismiss(event: MouseEvent) {
    if (event.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }
}
