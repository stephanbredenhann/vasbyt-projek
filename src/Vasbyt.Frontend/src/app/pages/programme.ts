import { Component, inject } from '@angular/core';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

/** Each row is the i18n stem: the dictionary holds `<stem>` and `<stem>Time` side by side. */
const DAYS: { titleKey: TranslationKey; rows: string[]; noteKey?: TranslationKey }[] = [
  {
    titleKey: 'program.day1',
    rows: [
      'program.d1.registration',
      'program.d1.registrationClose',
      'program.d1.briefing',
      'program.d1.stalls',
      'program.d1.gather',
      'program.d1.start',
    ],
    noteKey: 'program.d1.food',
  },
  {
    titleKey: 'program.day2',
    rows: ['program.d2.stalls', 'program.d2.opening', 'program.d2.start', 'program.d2.fires'],
  },
  {
    titleKey: 'program.day3',
    rows: [
      'program.d3.stalls',
      'program.d3.truck',
      'program.d3.opening',
      'program.d3.start',
      'program.d3.prizes',
    ],
  },
];

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
          @for (d of days; track d.titleKey) {
            <article class="card day">
              <h2>{{ i18n.t(d.titleKey) }}</h2>
              <dl>
                @for (r of d.rows; track r) {
                  <div class="row">
                    <dt class="chip chip--blue">{{ i18n.t(t(r, 'Time')) }}</dt>
                    <dd>
                      {{ i18n.t(t(r, '')) }}
                      @if (r === 'program.d1.briefing') {
                        <span class="muted">{{ i18n.t('program.d1.briefingItems') }}</span>
                      }
                    </dd>
                  </div>
                }
              </dl>
              @if (d.noteKey) {
                <p class="muted note">{{ i18n.t(d.noteKey) }}</p>
              }
            </article>
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
      margin-bottom: var(--space-6);
    }

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
  protected readonly days = DAYS;
  protected readonly terms = TERMS;
  protected readonly kit = KIT;

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
