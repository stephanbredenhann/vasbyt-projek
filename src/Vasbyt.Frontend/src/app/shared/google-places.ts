/* Minimal surface of the Places API this app touches. Typing it here beats pulling in
   @types/google.maps for one autocomplete widget. */
interface PlacesLibrary {
  Autocomplete: new (
    input: HTMLInputElement,
    options: Record<string, unknown>,
  ) => {
    addListener(event: string, handler: () => void): void;
    getPlace(): { address_components?: { types: string[]; long_name: string }[] } | undefined;
  };
}

declare global {
  interface Window {
    google?: { maps?: { places?: PlacesLibrary } };
  }
}

let pending: Promise<PlacesLibrary | null> | null = null;
let apiKey: string | null = null;

/** Called once at bootstrap with whatever /api/config returned. No key means the feature is off. */
export function configureGooglePlaces(key: string | null): void {
  apiKey = key?.trim() || null;
}

/**
 * Loads the Places script on first use and never again. Resolves to null — not a rejection — when
 * there is no key or the script fails, because every caller's fallback is the same: plain inputs.
 */
export function loadGooglePlaces(): Promise<PlacesLibrary | null> {
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps.places);
  if (!apiKey) return Promise.resolve(null);

  pending ??= new Promise<PlacesLibrary | null>((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey!)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google?.maps?.places ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return pending;
}
