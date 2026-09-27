/**
 * ADM0VE AI — Synthetic ML Dataset Generator
 *
 * IMPORTANT (scientific honesty):
 * This prototype uses SIMULATED training data because real campaign
 * exposure datasets are not publicly available. The generator encodes
 * realistic relationships between mobility, traffic, geographic and
 * temporal features and the resulting "Potential Exposure Score".
 * Noise is added so the relationship is NOT perfectly deterministic.
 *
 * Target variable: exposure_score (0–100)
 *   0  = very low potential exposure
 *   100 = very high potential exposure
 *
 * The platform NEVER claims to count exact human views. It predicts
 * "Potential Exposure Score" based on aggregate mobility signals.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ZoneProfile {
  zoneId: number;
  zoneName: string;
  city: string;
  category: 'COMMERCIAL' | 'RESIDENTIAL' | 'BUSINESS' | 'TOURIST' | 'INDUSTRIAL' | 'MIXED';
  baseTraffic: number;
  basePedestrian: number;
  baseVehicle: number;
}

export const ZONE_PROFILES: ZoneProfile[] = [
  { zoneId: 1,  zoneName: 'Centre Ville',     city: 'Tunis',     category: 'COMMERCIAL',  baseTraffic: 85, basePedestrian: 90, baseVehicle: 80 },
  { zoneId: 2,  zoneName: 'Lac 2',            city: 'Tunis',     category: 'BUSINESS',    baseTraffic: 78, basePedestrian: 65, baseVehicle: 85 },
  { zoneId: 3,  zoneName: 'Berges du Lac',    city: 'Tunis',     category: 'TOURIST',     baseTraffic: 72, basePedestrian: 80, baseVehicle: 70 },
  { zoneId: 4,  zoneName: 'Ariana',           city: 'Ariana',    category: 'MIXED',       baseTraffic: 68, basePedestrian: 60, baseVehicle: 72 },
  { zoneId: 5,  zoneName: 'La Marsa',         city: 'La Marsa',  category: 'TOURIST',     baseTraffic: 70, basePedestrian: 78, baseVehicle: 65 },
  { zoneId: 6,  zoneName: 'Sidi Bou Said',    city: 'Tunis',     category: 'TOURIST',     baseTraffic: 65, basePedestrian: 85, baseVehicle: 55 },
  { zoneId: 7,  zoneName: 'Carthage',         city: 'Carthage',  category: 'TOURIST',     baseTraffic: 60, basePedestrian: 82, baseVehicle: 50 },
  { zoneId: 8,  zoneName: 'Les Berges',       city: 'Tunis',     category: 'BUSINESS',    baseTraffic: 75, basePedestrian: 70, baseVehicle: 82 },
  { zoneId: 9,  zoneName: 'Manar 2',          city: 'Tunis',     category: 'RESIDENTIAL', baseTraffic: 55, basePedestrian: 45, baseVehicle: 60 },
  { zoneId: 10, zoneName: 'Ennasr',           city: 'Ariana',    category: 'RESIDENTIAL', baseTraffic: 58, basePedestrian: 50, baseVehicle: 62 },
  { zoneId: 11, zoneName: 'Jardins de Carthage', city: 'Carthage', category: 'MIXED',     baseTraffic: 62, basePedestrian: 68, baseVehicle: 60 },
  { zoneId: 12, zoneName: 'Sousse Centre',    city: 'Sousse',    category: 'COMMERCIAL',  baseTraffic: 80, basePedestrian: 85, baseVehicle: 75 },
  { zoneId: 13, zoneName: 'Hammam Sousse',    city: 'Sousse',    category: 'TOURIST',     baseTraffic: 68, basePedestrian: 75, baseVehicle: 60 },
  { zoneId: 14, zoneName: 'Port El Kantaoui', city: 'Sousse',    category: 'TOURIST',     baseTraffic: 65, basePedestrian: 88, baseVehicle: 52 },
  { zoneId: 15, zoneName: 'Sfax Ville',       city: 'Sfax',      category: 'COMMERCIAL',  baseTraffic: 82, basePedestrian: 78, baseVehicle: 84 },
  { zoneId: 16, zoneName: 'Sakiet Ezzit',     city: 'Sfax',      category: 'INDUSTRIAL',  baseTraffic: 50, basePedestrian: 35, baseVehicle: 68 },
  { zoneId: 17, zoneName: 'Bizerte Centre',   city: 'Bizerte',   category: 'COMMERCIAL',  baseTraffic: 66, basePedestrian: 70, baseVehicle: 60 },
  { zoneId: 18, zoneName: 'Nabeul',           city: 'Nabeul',    category: 'TOURIST',     baseTraffic: 64, basePedestrian: 72, baseVehicle: 58 },
  { zoneId: 19, zoneName: 'Hammamet',         city: 'Hammamet',  category: 'TOURIST',     baseTraffic: 70, basePedestrian: 86, baseVehicle: 55 },
  { zoneId: 20, zoneName: 'Megrine',          city: 'Ben Arous', category: 'INDUSTRIAL',  baseTraffic: 48, basePedestrian: 32, baseVehicle: 65 },
];

export interface DatasetRow {
  zone_id: number;
  zone_category: string;
  hour: number;
  day_of_week: number;
  month: number;
  traffic_index: number;
  pedestrian_index: number;
  vehicle_index: number;
  average_speed: number;
  distance: number;
  campaign_duration: number;
  target_audience_match: number;
  historical_exposure: number;
  weather_factor: number;
  exposure_score: number;
}

export const FEATURE_COLUMNS: (keyof DatasetRow)[] = [
  'zone_id',
  'hour',
  'day_of_week',
  'month',
  'traffic_index',
  'pedestrian_index',
  'vehicle_index',
  'average_speed',
  'distance',
  'campaign_duration',
  'target_audience_match',
  'historical_exposure',
  'weather_factor',
];

const CATEGORY_WEIGHT: Record<string, number> = {
  COMMERCIAL: 1.0,
  TOURIST: 0.95,
  MIXED: 0.82,
  BUSINESS: 0.78,
  RESIDENTIAL: 0.62,
  INDUSTRIAL: 0.4,
};

function gaussianNoise(mean: number, std: number, rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a realistic synthetic dataset.
 *
 * exposure_score is computed from meaningful feature relationships:
 *   base = weighted combination of traffic, pedestrian, vehicle indices
 *   + time-of-day curve (peak at rush hours)
 *   + day-of-week effect
 *   + seasonality (summer boost for tourist zones)
 *   + campaign factors (duration, target audience match, distance)
 *   + historical exposure trend
 *   + weather penalty
 *   + realistic gaussian noise
 *
 * Final score is clamped to [0, 100].
 */
export function generateDataset(n: number = 10000, seed: number = 42): DatasetRow[] {
  const rng = mulberry32(seed);
  const rows: DatasetRow[] = [];

  for (let i = 0; i < n; i++) {
    const zone = ZONE_PROFILES[Math.floor(rng() * ZONE_PROFILES.length)];
    const hour = Math.floor(rng() * 24);
    const dayOfWeek = Math.floor(rng() * 7);
    const month = 1 + Math.floor(rng() * 12);

    const hourFactor =
      Math.exp(-Math.pow(hour - 8.5, 2) / 4) * 0.6 +
      Math.exp(-Math.pow(hour - 18.5, 2) / 5) * 0.7 +
      Math.exp(-Math.pow(hour - 13, 2) / 3) * 0.35 +
      0.35;

    const isWeekend = dayOfWeek >= 5;
    const weekendMult = isWeekend
      ? zone.category === 'TOURIST' || zone.category === 'COMMERCIAL'
        ? 1.12
        : 0.78
      : 1.0;

    const summerBoost =
      (month >= 6 && month <= 8) && zone.category === 'TOURIST' ? 1.18 : 1.0;

    const trafficIndex = Math.min(
      100,
      Math.max(10, zone.baseTraffic * hourFactor * weekendMult * summerBoost + gaussianNoise(0, 6, rng))
    );
    const pedestrianIndex = Math.min(
      100,
      Math.max(10, zone.basePedestrian * hourFactor * weekendMult * summerBoost + gaussianNoise(0, 7, rng))
    );
    const vehicleIndex = Math.min(
      100,
      Math.max(10, zone.baseVehicle * hourFactor * weekendMult + gaussianNoise(0, 5, rng))
    );

    const averageSpeed = Math.max(
      5,
      50 - (trafficIndex / 100) * 35 + gaussianNoise(0, 6, rng)
    );

    const distance = Math.max(
      0.5,
      gaussianNoise(25, 12, rng) + (vehicleIndex / 100) * 15
    );

    const campaignDuration = Math.max(1, Math.round(gaussianNoise(30, 18, rng)));
    const targetAudienceMatch = Math.min(
      100,
      Math.max(20, gaussianNoise(65, 18, rng) + (zone.category === 'COMMERCIAL' ? 10 : 0))
    );

    const historicalExposure = Math.min(
      100,
      Math.max(
        10,
        (zone.baseTraffic * 0.4 + zone.basePedestrian * 0.6) * 0.85 +
          gaussianNoise(0, 10, rng)
      )
    );

    const weatherCode = Math.floor(rng() * 4);
    const weatherFactor = [1.0, 0.92, 0.8, 0.62][weatherCode];

    // === Compute target: exposure_score ===
    const catWeight = CATEGORY_WEIGHT[zone.category] ?? 0.7;

    const mobilityCore =
      trafficIndex * 0.28 +
      pedestrianIndex * 0.38 +
      vehicleIndex * 0.2 +
      historicalExposure * 0.14;

    const temporalCurve =
      Math.exp(-Math.pow(hour - 18.5, 2) / 8) * 18 +
      Math.exp(-Math.pow(hour - 8.5, 2) / 5) * 10 -
      (hour >= 0 && hour <= 5 ? 15 : 0);

    const campaignFactor =
      (targetAudienceMatch / 100) * 12 +
      Math.min(8, campaignDuration / 10) +
      Math.min(6, distance / 10);

    const categoryLift = (catWeight - 0.6) * 25;

    let rawScore =
      mobilityCore * catWeight +
      temporalCurve +
      campaignFactor +
      categoryLift;

    rawScore *= weatherFactor;
    rawScore *= weekendMult * 0.96 + 0.04;
    rawScore += gaussianNoise(0, 4.5, rng);

    const exposureScore = Math.min(100, Math.max(0, rawScore));

    rows.push({
      zone_id: zone.zoneId,
      zone_category: zone.category,
      hour,
      day_of_week: dayOfWeek,
      month,
      traffic_index: Math.round(trafficIndex),
      pedestrian_index: Math.round(pedestrianIndex),
      vehicle_index: Math.round(vehicleIndex),
      average_speed: Math.round(averageSpeed * 10) / 10,
      distance: Math.round(distance * 10) / 10,
      campaign_duration: campaignDuration,
      target_audience_match: Math.round(targetAudienceMatch),
      historical_exposure: Math.round(historicalExposure),
      weather_factor: Math.round(weatherFactor * 100) / 100,
      exposure_score: Math.round(exposureScore * 10) / 10,
    });
  }

  return rows;
}

export function saveDatasetCSV(rows: DatasetRow[], filepath: string): void {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => (row as any)[h]).join(','));
  }
  fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
}

export function loadDatasetCSV(filepath: string): DatasetRow[] {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const rows: DatasetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: any = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      const v = values[j];
      row[h] = h === 'zone_category' ? v : Number(v);
    }
    rows.push(row);
  }
  return rows;
}
