import { Injectable, signal } from '@angular/core';
import { TranslationKey, af } from './af';
import { en } from './en';

export type Locale = 'af' | 'en';

const STORAGE_KEY = 'vasbyt.locale';
const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { af, en };

/**
 * Runtime language toggle. Angular's built-in $localize needs one build per locale and so cannot
 * switch at runtime. Two flat dictionaries and a signal do the whole job in forty lines.
 *
 * t() reads the locale signal, so every template that calls it re-renders when the locale changes.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(read());

  t(key: TranslationKey): string {
    return DICTIONARIES[this.locale()][key] ?? key;
  }

  use(locale: Locale): void {
    this.locale.set(locale);
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Private browsing or blocked storage: the toggle still works for this session.
    }
  }

  toggle(): void {
    this.use(this.locale() === 'af' ? 'en' : 'af');
  }
}

function read(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'af';
  } catch {
    return 'af';
  }
}
