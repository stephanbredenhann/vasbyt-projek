import { Component, inject, input, output, signal } from '@angular/core';
import { ApiService, Upload } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';
import { ImageCropper } from '../../shared/image-cropper';
import { ImageSlot } from '../../shared/image-slot';

/**
 * Pick, crop to the slot's ratio, upload, keep the fileName, preview from the url, then save the
 * row. The CMS bodies take imageFileName and never imageUrl, so the parent stores what this emits,
 * not what it shows.
 */
@Component({
  selector: 'vb-image-field',
  standalone: true,
  imports: [ImageCropper, ImageSlot],
  template: `
    @if (picked(); as file) {
      <!-- Every slot on the site has a fixed ratio, so the crop happens here rather than in CSS. -->
      <vb-image-cropper
        [file]="file"
        [ratio]="ratio()"
        (cropped)="upload($event)"
        (cancelled)="picked.set(null)"
      />
    } @else {
      <vb-image
        [src]="url()"
        [alt]="alt()"
        [ratio]="ratio() + ''"
        [fit]="fit()"
        [label]="i18n.t('admin.image')"
      />

      <label class="field pick">
        <span>{{ i18n.t('admin.image') }}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          [disabled]="busy()"
          (change)="pick($event)"
        />
        <span class="field__hint">{{
          busy() ? i18n.t('admin.imageUploading') : i18n.t('admin.imageHint')
        }}</span>
      </label>
    }

    @if (error(); as e) {
      <p class="field__error">{{ e }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .pick {
      margin-top: var(--space-3);
    }

    input[type='file'] {
      font-size: 0.9375rem;
      max-width: 100%;
    }
  `,
})
export class ImageField {
  readonly url = input<string | null>(null);
  readonly alt = input('');
  /** The ratio this image is shown at on the public site, which is what the crop is locked to. */
  readonly ratio = input(4 / 3);
  readonly fit = input<'cover' | 'contain'>('cover');
  readonly uploaded = output<Upload>();

  protected readonly i18n = inject(I18nService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly picked = signal<File | null>(null);

  private api = inject(ApiService);

  protected pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.error.set('');
    this.picked.set(file);
    // Cleared straight away, so picking the same file twice still fires a change event.
    input.value = '';
  }

  protected upload(file: File) {
    this.busy.set(true);
    this.picked.set(null);
    this.api.adminUpload(file).subscribe({
      next: (u) => {
        this.busy.set(false);
        this.uploaded.emit(u);
      },
      // The server refuses a file over 5 MB or one whose magic bytes disagree, in Afrikaans.
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }
}
