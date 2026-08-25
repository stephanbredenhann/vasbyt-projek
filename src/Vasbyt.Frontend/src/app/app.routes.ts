import { Routes } from '@angular/router';
import { adminGuard, authGuard, paidOrderGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'roetes', loadComponent: () => import('./pages/routes-page').then((m) => m.RoutesPage) },
  { path: 'skenk', loadComponent: () => import('./pages/donate').then((m) => m.Donate) },
  { path: 'teken-aan', loadComponent: () => import('./pages/sign-in').then((m) => m.SignIn) },

  // The registration flow, in the order the organisers insisted on: choose, pay, then enter people.
  { path: 'registreer', loadComponent: () => import('./pages/register-choose').then((m) => m.RegisterChoose) },
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
