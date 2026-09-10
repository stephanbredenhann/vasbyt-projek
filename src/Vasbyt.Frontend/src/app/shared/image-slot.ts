import { Component, input } from '@angular/core';

/**
 * A fixed aspect-ratio image. Renders the photo at [src] and holds its space as flat sand when
 * there is none yet, so a page with no photo still lays out. No layout shift either way.
 *
 * Photos in public/foto: fietsryers-sonsondergang (landscape hero), fietsryer-pad,
 * fietsryer-wegspring, hardlopers-grondpad, deelnemers-monument (all portrait),
 * fietsryer-kanaal (landscape), dorpsdraf-plakkaat (the Dorpsdraf poster).
 * Route maps in public/roetes: {ligdraf,vasbyt,ligtrap,vastrap}-dag{1,2,3}.webp.
 */
@Component({
  selector: 'vb-image',
  standalone: true,
  template: `
    <div class="image-slot" [style.aspect-ratio]="ratio()">
      @if (src()) {
        <img
          [src]="src()"
          [alt]="alt()"
          [attr.loading]="eager() ? null : 'lazy'"
          [style.object-fit]="fit()"
          [style.object-position]="objectPosition()"
          decoding="async"
        />
      } @else {
        <span class="image-slot__label" aria-hidden="true">{{ label() }}</span>
      }
    </div>
  `,
  styles: `
    .image-slot {
      position: relative;
      width: 100%;
      overflow: hidden;
      background: var(--slot-bg, var(--karoo-sand));
      border-radius: var(--r-lg);
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-slot__label {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--karoo-stone);
    }
  `,
})
export class ImageSlot {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly ratio = input('16 / 9');
  readonly label = input('Foto');
  // Photos whose subject sits off centre, e.g. 'center 30%' to keep a face in frame.
  readonly objectPosition = input('center');
  // A logo is contained, never cropped. A photo fills the slot.
  readonly fit = input<'cover' | 'contain'>('cover');
  // A hero above the fold should load eagerly, everything else stays lazy.
  readonly eager = input(false);
}
