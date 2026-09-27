import { Component, effect, inject, input, signal } from '@angular/core';
import { EntrantSummary } from '../core/api.models';
import { I18nService } from '../i18n/i18n.service';

@Component({
  selector: 'vb-qr-pass',
  standalone: true,
  template: `
    <article class="pass" [attr.data-event]="entrant().routeCode">
      <div class="pass__identity">
        <p class="pass__brand">Orania Helpmekaar Vasbyt 2027</p>
        <h3>{{ entrant().firstName }} {{ entrant().lastName }}</h3>
        <p>{{ entrant().routeName }}</p>
        <strong class="pass__number">{{ entrant().entryNumber }}</strong>
        <p class="pass__hint">{{ i18n.t('pass.saved') }}</p>
        <div class="pass__actions">
          @if (imageUrl()) {
            <a class="btn btn--primary" [href]="imageUrl()" [download]="entrant().entryNumber + '.png'">
              {{ i18n.t('pass.download') }}
            </a>
            <button type="button" class="btn btn--ghost" (click)="print()">{{ i18n.t('pass.print') }}</button>
          }
        </div>
      </div>
      @if (imageUrl()) {
        <img class="pass__qr" [src]="imageUrl()" [alt]="i18n.t('pass.alt')" width="240" height="240" />
      } @else {
        <p class="pass__hint" role="status">{{ i18n.t(failed() ? 'common.error' : 'common.loading') }}</p>
      }
    </article>
  `,
  styles: `
    .pass { display: flex; justify-content: space-between; align-items: center; gap: var(--space-6); padding: var(--space-6); background: white; border: 2px solid var(--ev, var(--indigo)); border-radius: var(--r-lg); }
    .pass__brand { color: var(--ev, var(--indigo)); font-weight: 600; font-size: .8125rem; margin: 0 0 var(--space-3); }
    h3 { margin: 0; font-size: 1.5rem; }
    .pass__identity > p { margin-block: var(--space-2); }
    .pass__number { font-family: var(--font-display); font-size: 1.5rem; color: var(--indigo-deep); }
    .pass__hint { font-size: .8125rem; color: var(--ink-muted); max-width: 32ch; }
    .pass__qr { flex: none; width: 240px; height: 240px; border-radius: 0; image-rendering: pixelated; }
    .pass__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
    @media(max-width: 600px) { .pass { flex-direction: column-reverse; align-items: start; } .pass__qr { align-self: center; } }
  `,
})
export class QrPass {
  readonly entrant = input.required<EntrantSummary>();
  protected readonly i18n = inject(I18nService);
  protected readonly imageUrl = signal('');
  protected readonly failed = signal(false);

  constructor() {
    effect((onCleanup) => {
      const payload = this.entrant().qrPayload;
      let active = true;
      onCleanup(() => { active = false; });
      this.imageUrl.set('');
      this.failed.set(false);
      if (!payload) return;
      import('qrcode').then(({ default: qr }) => qr.toDataURL(payload, {
        scale: 12, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' },
      })).then(url => { if (active) this.imageUrl.set(url); })
        .catch(() => { if (active) this.failed.set(true); });
    });
  }

  protected print() {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    frame.title = this.i18n.t('pass.title');
    document.body.append(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) { frame.remove(); return; }
    doc.open();
    doc.write('<!doctype html><html><head><title>Vasbyt pass</title><style>body{font:18px Arial,sans-serif;text-align:center;padding:30px;color:#1d1e58}img{width:280px;height:280px}p{margin:12px 0}@page{margin:15mm}</style></head><body></body></html>');
    doc.close();
    const entrant = this.entrant();
    for (const text of ['Orania Helpmekaar Vasbyt 2027', `${entrant.firstName} ${entrant.lastName}`, entrant.routeName, entrant.entryNumber ?? '']) {
      const p = doc.createElement('p');
      p.textContent = text;
      doc.body.append(p);
    }
    const img = doc.createElement('img');
    img.alt = this.i18n.t('pass.alt');
    img.onload = () => { win.focus(); win.print(); };
    img.src = this.imageUrl();
    doc.body.append(img);
    const cleanup = setTimeout(() => frame.remove(), 60_000);
    win.onafterprint = () => { clearTimeout(cleanup); frame.remove(); };
  }
}
