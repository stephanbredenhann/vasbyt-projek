/* Afrikaans is the default locale and the source of truth: the brochure is Afrikaans and English
   is the translation. Copy lives in one module per area under ./af so parallel work on different
   pages never touches the same file. Keys stay flat and dotted. */
import { admin } from './af/admin';
import { demo } from './af/demo';
import { borge } from './af/borge';
import { common } from './af/common';
import { helpmekaar } from './af/helpmekaar';
import { home } from './af/home';
import { nav } from './af/nav';
import { program } from './af/program';
import { registreer } from './af/registreer';
import { rekening } from './af/rekening';
import { roetes } from './af/roetes';
import { verblyf } from './af/verblyf';
import { vrae } from './af/vrae';
import { winkel } from './af/winkel';

export const af = {
  ...nav,
  ...common,
  ...home,
  ...roetes,
  ...registreer,
  ...winkel,
  ...verblyf,
  ...borge,
  ...program,
  ...vrae,
  ...helpmekaar,
  ...rekening,
  ...admin,
  ...demo,
};

export type TranslationKey = keyof typeof af;
