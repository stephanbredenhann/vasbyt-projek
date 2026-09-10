import { Component, inject } from '@angular/core';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';

/* The answers to q2 and q15 are marked DRAFT in the dictionary: the functional description lists
   age limits and proof of student status as open decisions. They render, but the copy is not final. */
const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

@Component({
  selector: 'vb-faq',
  standalone: true,
  template: `
    <section class="section torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('faq.title') }}</h1>
        <p class="lead">{{ i18n.t('faq.intro') }}</p>
      </div>
    </section>

    <!-- <details> is the native accordion: keyboard and screen reader behaviour for free. -->
    <section class="section section--sand torn torn--to-canvas">
      <div class="container faq">
        @for (n of questions; track n) {
          <details class="card">
            <summary>
              <h2>{{ i18n.t(q(n)) }}</h2>
            </summary>
            <p>{{ i18n.t(a(n)) }}</p>
          </details>
        }
      </div>
    </section>

    <section class="section">
      <div class="container">
        <article class="card card--accent contact">
          <h2>{{ i18n.t('faq.contactTitle') }}</h2>
          <p>{{ i18n.t('faq.contactBody') }}</p>
          <p class="lines">
            <a [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('helpmekaar.email') }}</a>
            <a [href]="'tel:' + i18n.t('helpmekaar.phone')">{{ i18n.t('helpmekaar.phone') }}</a>
          </p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .faq {
      display: grid;
      gap: var(--space-3);
      max-width: 78ch;
    }

    details {
      padding: var(--space-4) var(--space-6);
    }

    summary {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      cursor: pointer;
      list-style: none;
      padding-block: var(--space-2);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary h2 {
      font-size: 1.0625rem;
      letter-spacing: 0.04em;
      margin: 0;
      flex: 1;
    }

    /* The marker is drawn, not typed: a plus that becomes a minus when the answer opens. */
    summary::after {
      content: '';
      flex: none;
      width: 14px;
      height: 14px;
      background: currentColor;
      color: var(--orange-ink);
      mask: linear-gradient(currentColor 0 0) 50% / 100% 2px no-repeat,
        linear-gradient(currentColor 0 0) 50% / 2px 100% no-repeat;
      -webkit-mask: linear-gradient(#000 0 0) 50% / 100% 2px no-repeat,
        linear-gradient(#000 0 0) 50% / 2px 100% no-repeat;
    }

    details[open] summary::after {
      mask: linear-gradient(currentColor 0 0) 50% / 100% 2px no-repeat;
      -webkit-mask: linear-gradient(#000 0 0) 50% / 100% 2px no-repeat;
    }

    details p {
      margin: 0 0 var(--space-2);
      padding-right: var(--space-8);
      color: var(--ink-muted);
    }

    .contact {
      max-width: 78ch;
    }

    .contact h2 {
      font-size: 1.375rem;
    }

    .lines {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin: 0;
    }
  `,
})
export class Faq {
  protected readonly i18n = inject(I18nService);
  protected readonly questions = QUESTIONS;

  protected q(n: number): TranslationKey {
    return `faq.q${n}` as TranslationKey;
  }

  protected a(n: number): TranslationKey {
    return `faq.a${n}` as TranslationKey;
  }
}
