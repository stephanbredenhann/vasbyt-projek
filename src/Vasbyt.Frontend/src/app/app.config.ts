import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { SeoService } from './core/seo.service';
import { I18nService } from './i18n/i18n.service';
import { configureGooglePlaces } from './shared/google-places';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' }), withViewTransitions({ skipInitialTransition: true })),

    provideAppInitializer(() => {
      const i18n = inject(I18nService);
      i18n.use(i18n.locale());
      inject(SeoService).init();

      // Fire and forget so first paint never waits on the API; guards and Places wait on their own.
      inject(AuthService).refresh().subscribe();
      inject(ApiService).config().subscribe({
        next: (c) => configureGooglePlaces(c.googleMapsApiKey),
        error: () => configureGooglePlaces(null),
      });
    }),
  ],
};
