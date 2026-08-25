export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  /** Cumulative distance from the start, in kilometres. */
  km: number;
}

export interface Track {
  points: TrackPoint[];
  distanceKm: number;
  /** Sum of positive elevation changes — the number cyclists and runners actually care about. */
  climbM: number;
  minEleM: number;
  maxEleM: number;
}

/**
 * Parses a Strava GPX export. DOMParser is already in the browser, so this needs no library —
 * a GPX track is just <trkpt lat lon><ele>.
 */
export function parseGpx(xml: string): Track {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Ongeldige GPX-lêer.');

  const points: TrackPoint[] = [];
  let km = 0;
  let climbM = 0;
  let previous: TrackPoint | null = null;

  for (const node of Array.from(doc.getElementsByTagName('trkpt'))) {
    const lat = Number(node.getAttribute('lat'));
    const lon = Number(node.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ele = Number(node.getElementsByTagName('ele')[0]?.textContent ?? 0);

    if (previous) {
      km += haversineKm(previous.lat, previous.lon, lat, lon);
      // Ignore sub-metre wobble: consumer GPS altitude noise otherwise inflates the climb badly.
      const rise = ele - previous.ele;
      if (rise > 1) climbM += rise;
    }

    const point = { lat, lon, ele, km };
    points.push(point);
    previous = point;
  }

  if (!points.length) throw new Error('Geen roetepunte in die GPX-lêer nie.');

  const elevations = points.map((p) => p.ele);
  return {
    points,
    distanceKm: km,
    climbM: Math.round(climbM),
    minEleM: Math.min(...elevations),
    maxEleM: Math.max(...elevations),
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
