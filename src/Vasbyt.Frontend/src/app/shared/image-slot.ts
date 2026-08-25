import { Component, input } from '@angular/core';

/**
 * A fixed aspect-ratio image slot. Holds its space as flat sand until a file is dropped into
 * src/assets/images/ and wired to [src] — no external placeholder service, no layout shift.
 */
@Component({
  selector: 'vb-image',
  standalone: true,
  template: `
    <div class="image-slot" [style.aspect-ratio]="ratio()">
      @if (src()) {
        <img [src]="src()" [alt]="alt()" loading="lazy" decoding="async" />
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
      background: var(--karoo-sand);
      border-radius: var(--radius);
    }

    img {
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
}
