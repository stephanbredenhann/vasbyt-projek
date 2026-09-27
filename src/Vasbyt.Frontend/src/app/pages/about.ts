import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

@Component({
  selector: 'vb-about',
  standalone: true,
  imports: [RouterLink, ImageSlot],
  template: `
    <section class="section torn torn--to-sand">
      <div class="container intro">
        <div>
          <p class="eyebrow">{{ i18n.t('helpmekaar.name') }}</p>
          <h1>{{ i18n.t('helpmekaar.title') }}</h1>
          <p class="lead">{{ i18n.t('helpmekaar.body1') }}</p>
          <p>{{ i18n.t('helpmekaar.body2') }}</p>
          <p>{{ i18n.t('helpmekaar.body3') }}</p>
        </div>
        <div class="stack">
          <vb-image
            src="/foto/helpmekaar-saam.webp"
            [alt]="i18n.t('home.communityPhoto')"
            ratio="4 / 5"
          />
          <img
            class="mark"
            src="/merk/orania-helpmekaar.png"
            [alt]="i18n.t('helpmekaar.name')"
            loading="lazy"
          />
        </div>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <h2>{{ i18n.t('oorsprong.title') }}</h2>
        <p class="lead">{{ i18n.t('oorsprong.body1') }}</p>

        <ol class="aims">
          <li class="card">{{ i18n.t('oorsprong.aim1') }}</li>
          <li class="card">{{ i18n.t('oorsprong.aim2') }}</li>
          <li class="card">{{ i18n.t('oorsprong.aim3') }}</li>
        </ol>

        <p>{{ i18n.t('oorsprong.body2') }}</p>
        <p>{{ i18n.t('oorsprong.body3') }}</p>
        <p class="slogan">{{ i18n.t('oorsprong.slogan') }}</p>
      </div>
    </section>

    <section class="section">
      <div class="container contact">
        <article class="card">
          <h2>{{ i18n.t('helpmekaar.contactTitle') }}</h2>
          <p class="lines">
            <a [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('helpmekaar.email') }}</a>
            <a [href]="'tel:' + i18n.t('helpmekaar.phone')">{{ i18n.t('helpmekaar.phone') }}</a>
          </p>
          <p>{{ i18n.t('helpmekaar.closing') }}</p>
          <a class="btn btn--primary" routerLink="/skenk">{{ i18n.t('nav.donate') }}</a>
        </article>

        <article class="card card--danger">
          <h2>{{ i18n.t('helpmekaar.emergencyTitle') }}</h2>
          <p class="lines">
            <strong>{{ i18n.t('helpmekaar.emergencyName') }}</strong>
            <a [href]="'tel:' + i18n.t('helpmekaar.emergencyPhone')">
              {{ i18n.t('helpmekaar.emergencyPhone') }}
            </a>
          </p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .intro {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
      gap: var(--space-12);
      align-items: start;
    }

    /* The wordmark is dark blue, orange and grey, so it only ever sits on a light ground. */
    .mark {
      width: 100%;
      max-width: 320px;
      height: auto;
      margin-inline: auto;
    }

    .contact {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--space-6);
      align-items: start;
    }

    .aims {
      list-style: none;
      counter-reset: aim;
      margin: var(--space-8) 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--space-6);
    }

    .aims li::before {
      counter-increment: aim;
      content: counter(aim);
      display: block;
      font-family: var(--font-display);
      font-size: 2.25rem;
      line-height: 1;
      color: var(--orange-ink);
      margin-bottom: var(--space-3);
    }

    .slogan {
      font-family: var(--font-display);
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--indigo-deep);
      margin-top: var(--space-8);
    }

    .lines {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: 1.0625rem;
    }

    .contact h2 {
      font-size: 1.375rem;
    }

    @media (max-width: 719px) {
      .intro {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class About {
  protected readonly i18n = inject(I18nService);
}
