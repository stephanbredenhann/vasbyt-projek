import { Component, inject, signal } from '@angular/core';
import { ProgrammeDay } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

const TERMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const KIT: { titleKey: TranslationKey; stem: string; count: number }[] = [
  { titleKey: 'bring.allTitle', stem: 'bring.all', count: 9 },
  { titleKey: 'bring.walkersTitle', stem: 'bring.walkers', count: 5 },
  { titleKey: 'bring.cyclistsTitle', stem: 'bring.cyclists', count: 9 },
];

@Component({
  selector: 'vb-programme',
  standalone: true,
  imports: [ImageSlot],
  template: `
    <section class="section torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('program.title') }}</h1>
        <p class="lead">{{ i18n.t('program.intro') }}</p>
        <p class="muted">{{ i18n.t('program.datesNote') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <div class="grid grid--3">
          @for (d of days(); track d.dayNumber) {
            <article class="card day">
              <h2>{{ i18n.locale() === 'af' ? d.titleAf : d.titleEn }}</h2>
              <p class="day__date">{{ date(d.dateLocal) }}</p>
              <dl>
                @for (r of d.entries; track $index) {
                  <div class="row">
                    <dt class="chip chip--blue">{{ r.timeLocal.slice(0, 5) }}</dt>
                    <dd>
                      {{ i18n.locale() === 'af' ? r.titleAf : r.titleEn }}
                      @if (i18n.locale() === 'af' ? r.detailAf : r.detailEn) {
                        <span class="muted">{{ i18n.locale() === 'af' ? r.detailAf : r.detailEn }}</span>
                      }
                    </dd>
                  </div>
                }
              </dl>
              @if (i18n.locale() === 'af' ? d.noteAf : d.noteEn) {
                <p class="muted note">{{ i18n.locale() === 'af' ? d.noteAf : d.noteEn }}</p>
              }
            </article>
          } @empty {
            <p class="muted" role="status">{{ i18n.t(failed() ? 'common.error' : 'common.loading') }}</p>
            @if (failed()) {
              <button type="button" class="btn btn--primary" (click)="load()">{{ i18n.t('programme.retry') }}</button>
            }
          }
        </div>
      </div>
    </section>

    <section class="section torn torn--to-sand">
      <div class="container">
        <h2>{{ i18n.t('program.tentTitle') }}</h2>
        <p class="lead">{{ i18n.t('program.tentBody') }}</p>

        <div class="social">
          <article class="card">
            <h3>{{ i18n.t('program.dorpsdrafTitle') }}</h3>
            <p>{{ i18n.t('program.dorpsdrafBody') }}</p>
            <vb-image
              src="/foto/dorpsdraf-plakkaat.webp"
              [alt]="i18n.t('program.dorpsdrafTitle')"
              ratio="3 / 4"
            />
          </article>
          <article class="card">
            <h3>{{ i18n.t('program.braaiTitle') }}</h3>
            <p>{{ i18n.t('program.braaiBody') }}</p>
          </article>
          <article class="card">
            <h3>{{ i18n.t('program.stallsTitle') }}</h3>
            <p>{{ i18n.t('program.stallsBody') }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <h2>{{ i18n.t('terms.title') }}</h2>
        <ol class="terms">
          @for (n of terms; track n) {
            <li>{{ i18n.t(term(n)) }}</li>
          }
        </ol>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2>{{ i18n.t('bring.title') }}</h2>
        <div class="grid grid--3">
          @for (k of kit; track k.stem) {
            <article class="card">
              <h3>{{ i18n.t(k.titleKey) }}</h3>
              <ul class="kit">
                @for (n of range(k.count); track n) {
                  <li>{{ i18n.t(t(k.stem, n)) }}</li>
                }
              </ul>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .day h2 {
      font-size: 1.375rem;
      margin-bottom: var(--space-2);
    }

    .day__date { color: var(--indigo); font-weight: 600; font-size: .875rem; margin-bottom: var(--space-6); }

    dl {
      margin: 0;
    }

    .row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-3);
      padding-block: var(--space-3);
    }

    .row + .row {
      border-top: 1px solid var(--rule);
    }

    dt {
      align-self: start;
      font-variant-numeric: tabular-nums;
    }

    dd {
      margin: 0;
      font-size: 0.9375rem;
    }

    dd .muted {
      display: block;
      font-size: 0.8125rem;
      margin-top: var(--space-1);
    }

    .note {
      margin: var(--space-4) 0 0;
      font-size: 0.875rem;
    }

    .social {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: var(--space-6);
      margin-top: var(--space-8);
      align-items: start;
    }

    .terms {
      max-width: 70ch;
      padding-left: var(--space-6);
    }

    .terms li {
      margin-bottom: var(--space-4);
    }

    .kit {
      margin: 0;
      padding-left: var(--space-6);
      font-size: 0.9375rem;
    }

    .kit li {
      margin-bottom: var(--space-2);
    }
  `,
})
export class Programme {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  protected readonly days = signal<ProgrammeDay[]>([]);
  protected readonly failed = signal(false);
  protected readonly terms = TERMS;
  protected readonly kit = KIT;

  constructor() { this.load(); }

  protected load() {
    this.failed.set(false);
    this.api.programme().subscribe({ next: days => this.days.set(days), error: () => this.failed.set(true) });
  }

  protected date(local: string) {
    return new Intl.DateTimeFormat(this.i18n.locale() === 'af' ? 'af-ZA' : 'en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(local + 'T12:00:00'));
  }

  protected t(stem: string, suffix: string | number): TranslationKey {
    return `${stem}${suffix}` as TranslationKey;
  }

  protected term(n: number): TranslationKey {
    return `terms.t${n}` as TranslationKey;
  }

  protected range(count: number) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
}
