import { Routes } from '@angular/router';
import { adminGuard, authGuard, paidOrderGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },

  // Public content, per the functional spec's main navigation.
  { path: 'roetes', loadComponent: () => import('./pages/routes-page').then((m) => m.RoutesPage) },
  { path: 'roetes/:code', loadComponent: () => import('./pages/route-detail').then((m) => m.RouteDetail) },
  { path: 'verblyf', loadComponent: () => import('./pages/accommodation').then((m) => m.Accommodation) },
  { path: 'borge', loadComponent: () => import('./pages/sponsors').then((m) => m.Sponsors) },
  { path: 'program', loadComponent: () => import('./pages/programme').then((m) => m.Programme) },
  { path: 'oor-helpmekaar', loadComponent: () => import('./pages/about').then((m) => m.About) },
  { path: 'vrae', loadComponent: () => import('./pages/faq').then((m) => m.Faq) },
  { path: 'skenk', loadComponent: () => import('./pages/donate').then((m) => m.Donate) },
  { path: 'winkel', loadComponent: () => import('./pages/shop').then(m => m.Shop) },
  { path: 'mandjie', loadComponent: () => import('./pages/basket').then(m => m.Basket) },
  { path: 'bestel', loadComponent: () => import('./pages/register-review').then(m => m.RegisterReview) },
  { path: 'bestel/:token/betaal', loadComponent: () => import('./pages/register-pay').then(m => m.RegisterPay) },
  { path: 'bestel/:token/klaar', loadComponent: () => import('./pages/register-done').then(m => m.RegisterDone) },
  { path: 'skep-rekening', loadComponent: () => import('./pages/create-account').then(m => m.CreateAccount) },
  { path: 'wagwoord-vergeet', loadComponent: () => import('./pages/password-reset').then(m => m.ForgotPassword) },
  { path: 'herstel-wagwoord', loadComponent: () => import('./pages/password-reset').then(m => m.ResetPassword) },
  { path: 'teken-aan', loadComponent: () => import('./pages/sign-in').then((m) => m.SignIn) },

  // The registration flow. Tickets, products and a donation are chosen and priced before payment;
  // payment then creates one participant form per ticket bought.
  { path: 'registreer', loadComponent: () => import('./pages/register-choose').then((m) => m.RegisterChoose) },
  { path: 'registreer/produkte', loadComponent: () => import('./pages/register-products').then((m) => m.RegisterProducts) },
  { path: 'registreer/skenking', redirectTo: 'mandjie' },
  { path: 'registreer/kontroleer', redirectTo: 'bestel' },
  { path: 'registreer/betaal', loadComponent: () => import('./pages/register-pay').then((m) => m.RegisterPay) },
  {
    path: 'registreer/:token/deelnemer/:index',
    canActivate: [paidOrderGuard],
    loadComponent: () => import('./pages/register-entrant').then((m) => m.RegisterEntrant),
  },
  { path: 'registreer/:token/klaar', loadComponent: () => import('./pages/register-done').then((m) => m.RegisterDone) },

  { path: 'rekening', canActivate: [authGuard], loadComponent: () => import('./pages/account').then((m) => m.Account) },
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin').then((m) => m.Admin) },

  { path: '**', redirectTo: '' },
];
