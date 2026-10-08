import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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

    provideAppInitializer(async () => {
      const i18n = inject(I18nService);
      i18n.use(i18n.locale());
      inject(SeoService).init();

      // Restore the session if the auth cookie is still good, and find out whether Places is
      // configured. Neither is allowed to block the app: a failure just means signed out, no Places.
      const auth = inject(AuthService);
      const api = inject(ApiService);
      await Promise.all([
        firstValueFrom(auth.refresh()).catch(() => null),
        firstValueFrom(api.config())
          .then((c) => configureGooglePlaces(c.googleMapsApiKey))
          .catch(() => configureGooglePlaces(null)),
      ]);
    }),
  ],
};
