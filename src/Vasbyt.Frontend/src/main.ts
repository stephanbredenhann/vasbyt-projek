import { registerLocaleData } from '@angular/common';
import af from '@angular/common/locales/af';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Dates render through the locale the toggle is on; en-US is Angular's built-in default.
registerLocaleData(af);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
