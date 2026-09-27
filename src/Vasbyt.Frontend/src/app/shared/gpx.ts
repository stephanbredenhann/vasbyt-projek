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
  descentM: number;
  /** Steepest average climb over any 500 m stretch, in percent. */
  maxGradePct: number;
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
  let descentM = 0;
  // Hysteresis: count a change only once it passes 3 m from the last counted height. A per-point
  // threshold drops almost everything on a dense 1 Hz track and keeps all the noise on a sparse one.
  let anchor: number | null = null;
  let previous: TrackPoint | null = null;

  for (const node of Array.from(doc.getElementsByTagName('trkpt'))) {
    const lat = Number(node.getAttribute('lat'));
    const lon = Number(node.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ele = Number(node.getElementsByTagName('ele')[0]?.textContent ?? 0);

    if (previous) {
      km += haversineKm(previous.lat, previous.lon, lat, lon);
    }

    if (anchor === null) anchor = ele;
    else if (ele - anchor > 3) { climbM += ele - anchor; anchor = ele; }
    else if (anchor - ele > 3) { descentM += anchor - ele; anchor = ele; }

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
    descentM: Math.round(descentM),
    maxGradePct: steepest(points, 0.5),
    minEleM: Math.min(...elevations),
    maxEleM: Math.max(...elevations),
  };
}

/** Two pointers over the track: the best rise over any window of at least windowKm. */
export function steepest(points: TrackPoint[], windowKm: number): number {
  let best = 0;
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    while (j < points.length && points[j].km - points[i].km < windowKm) j++;
    if (j === points.length) break;
    const grade = ((points[j].ele - points[i].ele) / ((points[j].km - points[i].km) * 1000)) * 100;
    if (grade > best) best = grade;
  }
  return Math.round(best * 10) / 10;
}

/** Every nth point plus the last, so a 9 000 point export draws as a few hundred. */
export function thin(points: TrackPoint[], max: number): TrackPoint[] {
  const step = Math.max(1, Math.ceil(points.length / max));
  const out = points.filter((_, i) => i % step === 0);
  if (out.at(-1) !== points.at(-1)) out.push(points.at(-1)!);
  return out;
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
