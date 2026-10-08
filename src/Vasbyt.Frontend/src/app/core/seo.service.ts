import { Injectable, effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';

// Public path to [title key, description key]. Unlisted paths (route detail, private pages) keep the server's tags.
const PAGES: Record<string, [TranslationKey, TranslationKey]> = {
  '/': ['home.title', 'seo.home'],
  '/roetes': ['nav.routes', 'seo.routes'],
  '/program': ['nav.programme', 'seo.programme'],
  '/verblyf': ['nav.accommodation', 'seo.accommodation'],
  '/borge': ['nav.sponsors', 'seo.sponsors'],
  '/oor-helpmekaar': ['nav.about', 'seo.about'],
  '/vrae': ['nav.faq', 'seo.faq'],
  '/skenk': ['nav.donate', 'seo.donate'],
  '/winkel': ['nav.shop', 'seo.shop'],
  '/registreer': ['nav.register', 'seo.register'],
};

/** Keeps title, description, canonical and og tags right on client navigation; the server writes them on first load. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private url = '';
  private first = true;

  /** Call once from an injection context. */
  init(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url = e.urlAfterRedirects;
        // The server already wrote Afrikaans tags for the first load.
        if (!(this.first && this.i18n.locale() === 'af')) this.update(this.url);
        this.first = false;
      });
    effect(() => {
      this.i18n.locale();
      if (this.url && !this.first) this.update(this.url);
    });
  }

  private update(url: string): void {
    const path = url.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
    const page = PAGES[path];
    if (!page) return;
    const [titleKey, descKey] = page;
    const site = 'Orania Helpmekaar Vasbyt';
    const title = path === '/' ? this.i18n.t(titleKey) : `${this.i18n.t(titleKey)} | ${site}`;
    const description = this.i18n.t(descKey);
    const href = location.origin + path;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: href });
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = href;
  }
}
