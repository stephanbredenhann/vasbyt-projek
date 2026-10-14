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
let setKey!: (key: string | null) => void;
// Bootstrap no longer waits for /api/config, so callers wait here for the key instead.
const apiKey = new Promise<string | null>((resolve) => (setKey = resolve));

/** Called once at bootstrap with whatever /api/config returned. No key means the feature is off. */
export function configureGooglePlaces(key: string | null): void {
  setKey(key?.trim() || null);
}

/**
 * Loads the Places script on first use and never again. Resolves to null — not a rejection — when
 * there is no key or the script fails, because every caller's fallback is the same: plain inputs.
 */
export async function loadGooglePlaces(): Promise<PlacesLibrary | null> {
  if (window.google?.maps?.places) return window.google.maps.places;
  const key = await apiKey;
  if (!key) return null;

  pending ??= new Promise<PlacesLibrary | null>((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google?.maps?.places ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return pending;
}
