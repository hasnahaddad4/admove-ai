/**
 * ADM0VE AI — Database Seeder
 *
 * Creates realistic demo data:
 *   1 company
 *   10 vehicles
 *   10 campaigns
 *   20 geographic zones (Tunisian cities for demonstration)
 *   ~10,000 GPS points
 *   ~4,800 traffic data records (20 zones × 24 hours × 10 days)
 *   ~3,000 exposure records
 *   ML predictions and recommendations
 *
 * IMPORTANT: All data is clearly labeled as demo/simulated data.
 */

import { db } from './db';
import { ZONE_PROFILES } from './ml/dataset';
import { predict } from './ml/model';

// Seeded RNG for reproducibility
function mulberry32(seed: number) {
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

const rng = mulberry32(123);
const rand = (min: number, max: number) => min + rng() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

// Realistic Tunisian coordinates for each zone
const ZONE_COORDS: Record<number, { lat: number; lng: number }> = {
  1: { lat: 36.8065, lng: 10.1815 },   // Centre Ville Tunis
  2: { lat: 36.8380, lng: 10.2480 },   // Lac 2
  3: { lat: 36.8350, lng: 10.2550 },   // Berges du Lac
  4: { lat: 36.8625, lng: 10.1938 },   // Ariana
  5: { lat: 36.8790, lng: 10.3240 },   // La Marsa
  6: { lat: 36.8700, lng: 10.3417 },   // Sidi Bou Said
  7: { lat: 36.8580, lng: 10.3330 },   // Carthage
  8: { lat: 36.8300, lng: 10.2400 },   // Les Berges
  9: { lat: 36.8450, lng: 10.1710 },   // Manar 2
  10: { lat: 36.8800, lng: 10.1680 },  // Ennasr
  11: { lat: 36.8600, lng: 10.3300 },  // Jardins de Carthage
  12: { lat: 35.8250, lng: 10.6410 },  // Sousse Centre
  13: { lat: 35.8580, lng: 10.6500 },  // Hammam Sousse
  14: { lat: 35.8330, lng: 10.5950 },  // Port El Kantaoui
  15: { lat: 34.7400, lng: 10.7600 },  // Sfax Ville
  16: { lat: 34.7850, lng: 10.7900 },  // Sakiet Ezzit
  17: { lat: 37.2740, lng: 9.8660 },   // Bizerte Centre
  18: { lat: 36.4560, lng: 10.7380 },  // Nabeul
  19: { lat: 36.4060, lng: 10.6130 },  // Hammamet
  20: { lat: 36.7550, lng: 10.2280 },  // Megrine
};

async function main() {
  console.log('Starting database seed...');

  // Clean existing data
  console.log('Cleaning existing data...');
  await db.taskComment.deleteMany();
  await db.task.deleteMany();
  await db.notification.deleteMany();
  await db.activityLog.deleteMany();
  await db.recommendation.deleteMany();
  await db.prediction.deleteMany();
  await db.exposureRecord.deleteMany();
  await db.trafficData.deleteMany();
  await db.gpsPoint.deleteMany();
  await db.campaignVehicle.deleteMany();
  await db.campaign.deleteMany();
  await db.vehicle.deleteMany();
  await db.zone.deleteMany();
  await db.modelVersion.deleteMany();
  await db.user.deleteMany();
  await db.company.deleteMany();

  // === Company ===
  const company = await db.company.create({
    data: {
      name: 'AdMove Mobility Group',
      industry: 'Mobile Advertising',
      address: 'Les Berges du Lac 2, Rue du Lac',
      city: 'Tunis',
      country: 'Tunisia',
    },
  });
  console.log(`Created company: ${company.name}`);

  // === Users (3 roles: ADMIN, MANAGER, EMPLOYEE) ===
  const { hashPassword } = await import('./auth');
  const adminPassword = await hashPassword('admin123');
  const managerPassword = await hashPassword('manager123');
  const employeePassword = await hashPassword('employee123');

  const adminUser = await db.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@admove.ai',
      passwordHash: adminPassword,
      role: 'ADMIN',
      jobTitle: 'System Administrator',
      companyId: company.id,
    },
  });

  const manager1 = await db.user.create({
    data: {
      name: 'Sarah Manager',
      email: 'manager@admove.ai',
      passwordHash: managerPassword,
      role: 'MANAGER',
      jobTitle: 'Campaign Manager',
      companyId: company.id,
    },
  });

  const manager2 = await db.user.create({
    data: {
      name: 'Karim Ben Salah',
      email: 'karim@admove.ai',
      passwordHash: managerPassword,
      role: 'MANAGER',
      jobTitle: 'Operations Manager',
      companyId: company.id,
    },
  });

  // Employees assigned to manager1 (Sarah)
  const emp1 = await db.user.create({
    data: {
      name: 'Alex Employee',
      email: 'employee@admove.ai',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      jobTitle: 'Field Operator',
      managerId: manager1.id,
      companyId: company.id,
    },
  });
  const emp2 = await db.user.create({
    data: {
      name: 'Mariem Trabelsi',
      email: 'mariem@admove.ai',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      jobTitle: 'Driver',
      managerId: manager1.id,
      companyId: company.id,
    },
  });
  const emp3 = await db.user.create({
    data: {
      name: 'Youssef Gharbi',
      email: 'youssef@admove.ai',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      jobTitle: 'Route Specialist',
      managerId: manager1.id,
      companyId: company.id,
    },
  });
  // Employees assigned to manager2 (Karim)
  const emp4 = await db.user.create({
    data: {
      name: 'Ines Khelifi',
      email: 'ines@admove.ai',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      jobTitle: 'Field Operator',
      managerId: manager2.id,
      companyId: company.id,
    },
  });
  const emp5 = await db.user.create({
    data: {
      name: 'Mohamed Sassi',
      email: 'mohamed@admove.ai',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      jobTitle: 'Driver',
      managerId: manager2.id,
      companyId: company.id,
    },
  });

  console.log('Created 7 demo users (1 admin, 2 managers, 5 employees)');

  const employees = [emp1, emp2, emp3, emp4, emp5];
  const managers = [manager1, manager2];

  // === Zones ===
  const zoneMap = new Map<number, string>();
  for (const zp of ZONE_PROFILES) {
    const coords = ZONE_COORDS[zp.zoneId];
    const zone = await db.zone.create({
      data: {
        name: zp.zoneName,
        city: zp.city,
        latitude: coords.lat,
        longitude: coords.lng,
        radius: 500,
        category: zp.category,
        estimatedTraffic: zp.baseTraffic,
        estimatedFrequentation: zp.basePedestrian,
      },
    });
    zoneMap.set(zp.zoneId, zone.id);
  }
  console.log(`Created ${zoneMap.size} geographic zones`);

  // === Traffic Data (10 days × 24 hours for each zone) ===
  console.log('Generating traffic data...');
  const trafficBatch: any[] = [];
  const now = new Date();
  for (const zp of ZONE_PROFILES) {
    const zoneId = zoneMap.get(zp.zoneId)!;
    for (let d = 9; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      for (let h = 0; h < 24; h++) {
        const hourFactor =
          Math.exp(-Math.pow(h - 8.5, 2) / 4) * 0.6 +
          Math.exp(-Math.pow(h - 18.5, 2) / 5) * 0.7 +
          0.35;
        trafficBatch.push({
          zoneId,
          date,
          hour: h,
          trafficIndex: Math.min(100, Math.max(10, Math.round(zp.baseTraffic * hourFactor + rand(-5, 5)))),
          pedestrianIndex: Math.min(100, Math.max(10, Math.round(zp.basePedestrian * hourFactor + rand(-5, 5)))),
          vehicleIndex: Math.min(100, Math.max(10, Math.round(zp.baseVehicle * hourFactor + rand(-5, 5)))),
        });
      }
    }
  }
  // Batch insert in chunks
  for (let i = 0; i < trafficBatch.length; i += 500) {
    await db.trafficData.createMany({ data: trafficBatch.slice(i, i + 500) });
  }
  console.log(`Created ${trafficBatch.length} traffic data records`);

  // === Vehicles ===
  const vehicleTypes = ['TRUCK', 'VAN', 'CAR', 'BUS', 'SCOOTER'];
  const vehicles: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const startZone = pick(ZONE_PROFILES);
    const coords = ZONE_COORDS[startZone.zoneId];
    const v = await db.vehicle.create({
      data: {
        companyId: company.id,
        name: `AdMove Vehicle ${String(i).padStart(2, '0')}`,
        plateNumber: `TN-${1000 + i}-${pick(['T', 'S', 'N', 'B'])}`,
        vehicleType: vehicleTypes[i % vehicleTypes.length],
        status: i <= 6 ? 'ACTIVE' : i <= 8 ? 'IDLE' : 'MAINTENANCE',
        currentLatitude: coords.lat + rand(-0.005, 0.005),
        currentLongitude: coords.lng + rand(-0.005, 0.005),
      },
    });
    vehicles.push(v.id);
  }
  console.log(`Created ${vehicles.length} vehicles`);

  // === Campaigns ===
  const campaignData = [
    { name: 'Summer Product Launch', product: 'New Beverage Line', audience: 'Young Adults 18-35', budget: 45000, days: 45 },
    { name: 'Ramadan Special Promotion', product: 'Food Delivery App', audience: 'Families 25-50', budget: 38000, days: 30 },
    { name: 'Back to School Campaign', product: 'Educational Tech', audience: 'Students & Parents', budget: 28000, days: 35 },
    { name: 'Tech Conference Branding', product: 'SaaS Platform', audience: 'Professionals 28-45', budget: 52000, days: 20 },
    { name: 'Luxury Auto Showcase', product: 'Premium Car Brand', audience: 'High Income 35-55', budget: 65000, days: 40 },
    { name: 'Health & Wellness Drive', product: 'Fitness App', audience: 'Health-conscious 20-40', budget: 32000, days: 50 },
    { name: 'Real Estate Tour', product: 'Property Development', audience: 'Home Buyers 30-55', budget: 58000, days: 60 },
    { name: 'Financial Services Push', product: 'Banking App', audience: 'Adults 22-50', budget: 42000, days: 38 },
    { name: 'Fashion Week Mobile', product: 'Clothing Brand', audience: 'Fashion Enthusiasts 18-35', budget: 35000, days: 25 },
    { name: 'Tourism Board Promotion', product: 'Travel Packages', audience: 'Tourists & Locals', budget: 48000, days: 55 },
  ];

  const campaigns: string[] = [];
  for (let i = 0; i < campaignData.length; i++) {
    const cd = campaignData[i];
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - randInt(10, cd.days));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + cd.days);
    const status = endDate < now ? 'COMPLETED' : startDate <= now ? 'ACTIVE' : 'PLANNED';

    const campaign = await db.campaign.create({
      data: {
        companyId: company.id,
        name: cd.name,
        description: `${cd.product} campaign targeting ${cd.audience}`,
        product: cd.product,
        targetAudience: cd.audience,
        startDate,
        endDate,
        budget: cd.budget,
        status,
      },
    });
    campaigns.push(campaign.id);

    // Assign 2-3 vehicles to each campaign
    const numVehicles = randInt(2, 3);
    const assignedVehicles = new Set<string>();
    for (let v = 0; v < numVehicles; v++) {
      let vid = pick(vehicles);
      let attempts = 0;
      while (assignedVehicles.has(vid) && attempts < 10) {
        vid = pick(vehicles);
        attempts++;
      }
      assignedVehicles.add(vid);
      await db.campaignVehicle.create({
        data: { campaignId: campaign.id, vehicleId: vid },
      });
    }
  }
  console.log(`Created ${campaigns.length} campaigns with vehicle assignments`);

  // === GPS Points + Exposure Records ===
  console.log('Generating GPS points and exposure records...');
  const gpsBatch: any[] = [];
  const exposureBatch: any[] = [];
  let gpsCount = 0;
  let exposureCount = 0;
  const TARGET_GPS = 10000;

  // For each active/completed campaign, generate GPS + exposure data
  for (const campaignId of campaigns) {
    const campaignVehicles = await db.campaignVehicle.findMany({
      where: { campaignId },
    });
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) continue;

    const daysActive = Math.max(
      1,
      Math.min(
        30,
        Math.round(
          (Math.min(now.getTime(), campaign.endDate.getTime()) -
            campaign.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    );

    for (const cv of campaignVehicles) {
      // Generate GPS points: ~30-50 points per day per vehicle
      const pointsPerDay = randInt(25, 40);
      const totalPoints = Math.min(
        Math.floor((TARGET_GPS * 2) / (campaigns.length * campaignVehicles.length)),
        daysActive * pointsPerDay
      );

      let prevLat = 36.8 + rand(-0.05, 0.05);
      let prevLng = 10.2 + rand(-0.05, 0.05);
      const visitedZones = new Set<string>();

      for (let p = 0; p < totalPoints; p++) {
        const dayOffset = Math.floor((p / totalPoints) * daysActive);
        const hour = randInt(7, 22);
        const ts = new Date(campaign.startDate);
        ts.setDate(ts.getDate() + dayOffset);
        ts.setHours(hour, randInt(0, 59), 0, 0);

        // Move toward a random zone
        const targetZone = pick(ZONE_PROFILES);
        const targetCoords = ZONE_COORDS[targetZone.zoneId];
        const step = 0.008;
        prevLat += (targetCoords.lat - prevLat) * step + rand(-0.003, 0.003);
        prevLng += (targetCoords.lng - prevLng) * step + rand(-0.003, 0.003);

        // Find nearest zone
        let nearestZoneId = 1;
        let nearestDist = Infinity;
        for (const zp of ZONE_PROFILES) {
          const c = ZONE_COORDS[zp.zoneId];
          const d = Math.hypot(c.lat - prevLat, c.lng - prevLng);
          if (d < nearestDist) {
            nearestDist = d;
            nearestZoneId = zp.zoneId;
          }
        }

        const zoneDbId = zoneMap.get(nearestZoneId)!;
        const speed = Math.round(rand(10, 50) * 10) / 10;
        const dist = Math.round(rand(0.2, 3.5) * 100) / 100;

        gpsBatch.push({
          vehicleId: cv.vehicleId,
          campaignId,
          latitude: Math.round(prevLat * 1e6) / 1e6,
          longitude: Math.round(prevLng * 1e6) / 1e6,
          timestamp: ts,
          speed,
          distanceFromPreviousPoint: dist,
        });
        gpsCount++;

        // Create exposure record for some points (1 in 4)
        if (p % 4 === 0 && nearestDist < 0.02) {
          visitedZones.add(zoneDbId);
          const zp = ZONE_PROFILES.find((z) => z.zoneId === nearestZoneId)!;
          const hourFactor =
            Math.exp(-Math.pow(hour - 8.5, 2) / 4) * 0.6 +
            Math.exp(-Math.pow(hour - 18.5, 2) / 5) * 0.7 +
            0.35;
          const trafficIdx = Math.min(100, Math.max(10, Math.round(zp.baseTraffic * hourFactor + rand(-5, 5))));
          const pedIdx = Math.min(100, Math.max(10, Math.round(zp.basePedestrian * hourFactor + rand(-5, 5))));
          const vehIdx = Math.min(100, Math.max(10, Math.round(zp.baseVehicle * hourFactor + rand(-5, 5))));

          // Use the ML model to predict exposure score for this record
          let score = 50;
          try {
            const pred = predict({
              zone_id: nearestZoneId,
              hour,
              day_of_week: ts.getDay(),
              month: ts.getMonth() + 1,
              traffic_index: trafficIdx,
              pedestrian_index: pedIdx,
              vehicle_index: vehIdx,
              average_speed: speed,
              distance: dist,
              campaign_duration: daysActive,
              target_audience_match: randInt(50, 85),
              historical_exposure: Math.round((zp.baseTraffic * 0.4 + zp.basePedestrian * 0.6) * 0.85),
              weather_factor: pick([1.0, 1.0, 0.92, 0.8]),
            });
            score = pred.predicted_exposure_score;
          } catch {
            // Model not available, use heuristic
            score = Math.round(
              trafficIdx * 0.3 + pedIdx * 0.35 + vehIdx * 0.2 + (hour >= 17 && hour <= 20 ? 15 : 0)
            );
          }

          const estimatedExposure = Math.round(score * rand(80, 150));

          exposureBatch.push({
            campaignId,
            vehicleId: cv.vehicleId,
            zoneId: zoneDbId,
            date: ts,
            hour,
            estimatedExposure,
            exposureScore: Math.round(score * 10) / 10,
          });
          exposureCount++;
        }
      }
    }
  }

  // Batch insert GPS
  for (let i = 0; i < gpsBatch.length; i += 500) {
    await db.gpsPoint.createMany({ data: gpsBatch.slice(i, i + 500) });
  }
  console.log(`Created ${gpsCount} GPS points`);

  // Batch insert exposures
  for (let i = 0; i < exposureBatch.length; i += 500) {
    await db.exposureRecord.createMany({ data: exposureBatch.slice(i, i + 500) });
  }
  console.log(`Created ${exposureCount} exposure records`);

  // === AI Predictions (for all zones, current day) ===
  console.log('Generating AI predictions...');
  const predictionBatch: any[] = [];
  const today = new Date();
  for (const zp of ZONE_PROFILES) {
    const zoneDbId = zoneMap.get(zp.zoneId)!;
    for (let h = 0; h < 24; h++) {
      const hourFactor =
        Math.exp(-Math.pow(h - 8.5, 2) / 4) * 0.6 +
        Math.exp(-Math.pow(h - 18.5, 2) / 5) * 0.7 +
        0.35;
      const trafficIdx = Math.min(100, Math.max(10, Math.round(zp.baseTraffic * hourFactor)));
      const pedIdx = Math.min(100, Math.max(10, Math.round(zp.basePedestrian * hourFactor)));
      const vehIdx = Math.min(100, Math.max(10, Math.round(zp.baseVehicle * hourFactor)));

      try {
        const pred = predict({
          zone_id: zp.zoneId,
          hour: h,
          day_of_week: today.getDay(),
          month: today.getMonth() + 1,
          traffic_index: trafficIdx,
          pedestrian_index: pedIdx,
          vehicle_index: vehIdx,
          average_speed: Math.round(Math.max(5, 50 - trafficIdx * 0.35)),
          distance: 25,
          campaign_duration: 30,
          target_audience_match: 65,
          historical_exposure: Math.round((zp.baseTraffic * 0.4 + zp.basePedestrian * 0.6) * 0.85),
          weather_factor: 1.0,
        });
        predictionBatch.push({
          zoneId: zoneDbId,
          predictionDate: today,
          hour: h,
          predictedScore: pred.predicted_exposure_score,
          confidence: pred.confidence,
          modelVersion: pred.model_version,
        });
      } catch (e) {
        // skip if model unavailable
      }
    }
  }
  if (predictionBatch.length > 0) {
    await db.prediction.createMany({ data: predictionBatch });
  }
  console.log(`Created ${predictionBatch.length} AI predictions`);

  // === Recommendations for each campaign ===
  console.log('Generating AI recommendations...');
  for (const campaignId of campaigns) {
    const recs: any[] = [];
    for (const zp of ZONE_PROFILES) {
      const zoneDbId = zoneMap.get(zp.zoneId)!;
      // Find best hour for this zone
      let bestHour = 18;
      let bestScore = 0;
      for (let h = 6; h <= 22; h++) {
        const hourFactor =
          Math.exp(-Math.pow(h - 8.5, 2) / 4) * 0.6 +
          Math.exp(-Math.pow(h - 18.5, 2) / 5) * 0.7 +
          0.35;
        const trafficIdx = Math.min(100, Math.max(10, Math.round(zp.baseTraffic * hourFactor)));
        const pedIdx = Math.min(100, Math.max(10, Math.round(zp.basePedestrian * hourFactor)));

        try {
          const pred = predict({
            zone_id: zp.zoneId,
            hour: h,
            day_of_week: today.getDay(),
            month: today.getMonth() + 1,
            traffic_index: trafficIdx,
            pedestrian_index: pedIdx,
            vehicle_index: Math.min(100, Math.max(10, Math.round(zp.baseVehicle * hourFactor))),
            average_speed: Math.round(Math.max(5, 50 - trafficIdx * 0.35)),
            distance: 25,
            campaign_duration: 30,
            target_audience_match: 65,
            historical_exposure: Math.round((zp.baseTraffic * 0.4 + zp.basePedestrian * 0.6) * 0.85),
            weather_factor: 1.0,
          });
          if (pred.predicted_exposure_score > bestScore) {
            bestScore = pred.predicted_exposure_score;
            bestHour = h;
          }
        } catch {}
      }

      // Generate reason
      const reasons: string[] = [];
      if (zp.baseTraffic > 70) reasons.push(`high traffic index (${zp.baseTraffic})`);
      if (zp.basePedestrian > 70) reasons.push(`strong pedestrian activity (${zp.basePedestrian})`);
      if (bestHour >= 16 && bestHour <= 20) reasons.push(`peak exposure window at ${bestHour}:00`);
      if (zp.category === 'COMMERCIAL' || zp.category === 'TOURIST') reasons.push(`${zp.category.toLowerCase()} zone with high audience potential`);
      if (reasons.length === 0) reasons.push(`moderate exposure potential`);

      recs.push({
        campaignId,
        zoneId: zoneDbId,
        recommendedHour: bestHour,
        score: Math.round(bestScore * 10) / 10,
        reason: `High recommendation due to ${reasons.join(', ')}.`,
      });
    }

    // Sort by score and assign priority
    recs.sort((a, b) => b.score - a.score);
    recs.forEach((r, i) => (r.priority = i + 1));

    // Keep top 10
    await db.recommendation.createMany({ data: recs.slice(0, 10) });
  }
  console.log('Generated AI recommendations for all campaigns');

  // === Model Version record ===
  const { loadMetadata } = await import('./ml/model');
  const meta = loadMetadata();
  if (meta) {
    await db.modelVersion.create({
      data: {
        name: meta.name,
        version: meta.version,
        algorithm: meta.algorithm,
        mae: meta.mae,
        rmse: meta.rmse,
        r2: meta.r2,
        trainedAt: new Date(meta.trainedAt),
        datasetSize: meta.datasetSize,
        features: JSON.stringify(meta.featureNames),
        isCurrent: true,
      },
    });
    console.log('Saved model version record');
  }

  // === Tasks ===
  console.log('Generating tasks...');
  const taskTitles = [
    'Drive route Centre Ville - Lac 2 morning shift',
    'Verify vehicle TN-1001-S maintenance status',
    'Capture photos at Sousse Centre campaign zone',
    'Update GPS tracker on Vehicle 05',
    'Monitor exposure metrics for Summer Product Launch',
    'Coordinate with driver for Hammamet tourist route',
    'Log end-of-day mileage for campaign report',
    'Inspect advertising panel on Vehicle 03',
    'Collect traffic data at La Marsa 17:00-19:00',
    'Prepare campaign performance summary',
    'Reassign Vehicle 08 to active campaign',
    'Review AI recommendations for Fashion Week Mobile',
  ];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const statuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  const taskIds: string[] = [];
  for (let i = 0; i < taskTitles.length; i++) {
    const assignee = pick(employees);
    const creator = assignee.managerId === manager1.id ? manager1 : manager2;
    const status = i < 4 ? 'COMPLETED' : i < 7 ? 'IN_PROGRESS' : i < 10 ? 'TODO' : pick(['TODO', 'CANCELLED']);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + randInt(-2, 14));

    const task = await db.task.create({
      data: {
        title: taskTitles[i],
        description: `Task: ${taskTitles[i]}. Please complete this task according to the operational guidelines. Report any issues to your manager.`,
        status,
        priority: pick(priorities),
        assignedToId: assignee.id,
        assignedById: creator.id,
        campaignId: i < 8 ? campaigns[i % campaigns.length] : null,
        dueDate,
        completedAt: status === 'COMPLETED' ? new Date(Date.now() - randInt(1, 72) * 3600 * 1000) : null,
      },
    });
    taskIds.push(task.id);

    // Add a comment for some tasks
    if (rng() > 0.5) {
      await db.taskComment.create({
        data: {
          taskId: task.id,
          userId: assignee.id,
          content: pick([
            'Started working on this task. Will update once complete.',
            'Encountered minor delay due to traffic. On track to finish.',
            'Task completed successfully. All requirements met.',
            'Need clarification on the route — messaged manager.',
            'Coordinating with the driver. ETA 30 mins.',
          ]),
        },
      });
    }
  }
  console.log(`Created ${taskIds.length} tasks with comments`);

  // === Notifications ===
  console.log('Generating notifications...');
  const notifBatch: any[] = [];
  for (const emp of employees) {
    // Each employee gets 2-3 notifications
    const count = randInt(2, 3);
    for (let n = 0; n < count; n++) {
      const templates = [
        { title: 'New task assigned', message: 'You have a new task. Check My Tasks.', type: 'TASK', link: 'my-tasks' },
        { title: 'Task deadline approaching', message: 'A task is due soon. Please review.', type: 'TASK', link: 'my-tasks' },
        { title: 'Campaign update', message: 'A campaign you are part of has been updated.', type: 'CAMPAIGN', link: 'my-campaigns' },
        { title: 'Welcome to AdMove AI', message: 'Your account is ready. Start by reviewing your tasks.', type: 'SYSTEM', link: null },
      ];
      const t = pick(templates);
      notifBatch.push({
        userId: emp.id,
        title: t.title,
        message: t.message,
        type: t.type,
        link: t.link,
        read: rng() > 0.6,
        createdAt: new Date(Date.now() - randInt(1, 240) * 3600 * 1000),
      });
    }
  }
  // Also give managers notifications
  for (const m of managers) {
    notifBatch.push({
      userId: m.id,
      title: 'Team task completed',
      message: 'A team member completed a task. Review the Tasks page.',
      type: 'TASK',
      link: 'tasks',
      read: false,
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    });
  }
  await db.notification.createMany({ data: notifBatch });
  console.log(`Created ${notifBatch.length} notifications`);

  // === Activity Logs ===
  console.log('Generating activity logs...');
  const logBatch: any[] = [];
  const allUsers = [adminUser, ...managers, ...employees];
  for (const u of allUsers) {
    // Each user has 3-6 activity entries
    const count = randInt(3, 6);
    for (let a = 0; a < count; a++) {
      const actions = u.role === 'ADMIN'
        ? ['LOGIN', 'CREATE_USER', 'UPDATE_CAMPAIGN', 'VIEW_ANALYTICS', 'TRAIN_MODEL']
        : u.role === 'MANAGER'
        ? ['LOGIN', 'CREATE_TASK', 'UPDATE_TASK', 'VIEW_CAMPAIGN', 'COMMENT_TASK']
        : ['LOGIN', 'UPDATE_TASK', 'VIEW_MY_TASKS', 'COMMENT_TASK', 'COMPLETE_TASK'];
      logBatch.push({
        userId: u.id,
        action: pick(actions),
        entity: pick(['task', 'campaign', 'vehicle', 'user', null]),
        entityId: rng() > 0.5 ? pick(taskIds) : null,
        createdAt: new Date(Date.now() - randInt(1, 240) * 3600 * 1000),
      });
    }
  }
  await db.activityLog.createMany({ data: logBatch });
  console.log(`Created ${logBatch.length} activity logs`);

  console.log('\n✅ Seed complete!');
  console.log('\nDemo credentials:');
  console.log('  Admin:     admin@admove.ai / admin123');
  console.log('  Manager:   manager@admove.ai / manager123');
  console.log('  Employee:  employee@admove.ai / employee123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
