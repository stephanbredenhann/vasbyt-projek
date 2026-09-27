/* English mirrors the Afrikaans dictionary. The Record type below fails the build the moment an
   area file adds an Afrikaans key without its English counterpart. */
import { TranslationKey } from './af';
import { admin } from './en/admin';
import { demo } from './en/demo';
import { borge } from './en/borge';
import { common } from './en/common';
import { helpmekaar } from './en/helpmekaar';
import { home } from './en/home';
import { nav } from './en/nav';
import { program } from './en/program';
import { registreer } from './en/registreer';
import { rekening } from './en/rekening';
import { roetes } from './en/roetes';
import { verblyf } from './en/verblyf';
import { vrae } from './en/vrae';
import { winkel } from './en/winkel';

export const en: Record<TranslationKey, string> = {
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
