import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const vehicleId = searchParams.get('vehicleId');
    const zoneId = searchParams.get('zoneId');
    const days = parseInt(searchParams.get('days') || '30');

    const companyId = auth.companyId || undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // KPIs
    const activeCampaigns = await db.campaign.count({
      where: { companyId, status: 'ACTIVE' },
    });
    const activeVehicles = await db.vehicle.count({
      where: { companyId, status: 'ACTIVE' },
    });
    const totalDistance = await db.gpsPoint.aggregate({
      _sum: { distanceFromPreviousPoint: true },
      where: { timestamp: { gte: startDate } },
    });
    const avgExposure = await db.exposureRecord.aggregate({
      _avg: { exposureScore: true },
      where: { date: { gte: startDate }, campaign: { companyId } },
    });

    // Best performing zone
    const zoneExposure = await db.exposureRecord.groupBy({
      by: ['zoneId'],
      where: { campaign: { companyId } },
      _avg: { exposureScore: true },
      orderBy: { _avg: { exposureScore: 'desc' } },
      take: 1,
    });
    let bestZoneName = 'N/A';
    if (zoneExposure[0]) {
      const z = await db.zone.findUnique({ where: { id: zoneExposure[0].zoneId } });
      bestZoneName = z?.name || 'N/A';
    }

    // AI optimization gain: compare average exposure vs best predictions
    const bestPredictions = await db.prediction.findMany({
      orderBy: { predictedScore: 'desc' },
      take: 100,
    });
    const avgBestPrediction =
      bestPredictions.length > 0
        ? bestPredictions.reduce((s, p) => s + p.predictedScore, 0) / bestPredictions.length
        : 0;
    const currentAvg = avgExposure._avg.exposureScore || 0;
    const optimizationGain = currentAvg > 0
      ? Math.round(((avgBestPrediction - currentAvg) / currentAvg) * 1000) / 10
      : 0;

    // Exposure over time (daily)
    const exposures = await db.exposureRecord.findMany({
      where: {
        date: { gte: startDate },
        campaign: { companyId },
        ...(campaignId ? { campaignId } : {}),
        ...(zoneId ? { zoneId } : {}),
      },
      select: { date: true, exposureScore: true },
      orderBy: { date: 'asc' },
    });

    // Group by day
    const dailyExposure = new Map<string, { sum: number; count: number }>();
    for (const e of exposures) {
      const dayKey = e.date.toISOString().slice(0, 10);
      const existing = dailyExposure.get(dayKey) || { sum: 0, count: 0 };
      existing.sum += e.exposureScore;
      existing.count++;
      dailyExposure.set(dayKey, existing);
    }
    const exposureOverTime = Array.from(dailyExposure.entries()).map(([date, v]) => ({
      date,
      avgScore: Math.round((v.sum / v.count) * 10) / 10,
    }));

    // Distance over time
    const gpsPoints = await db.gpsPoint.findMany({
      where: {
        timestamp: { gte: startDate },
        ...(vehicleId ? { vehicleId } : {}),
        ...(campaignId ? { campaignId } : {}),
      },
      select: { timestamp: true, distanceFromPreviousPoint: true },
      orderBy: { timestamp: 'asc' },
    });
    const dailyDistance = new Map<string, number>();
    for (const g of gpsPoints) {
      const dayKey = g.timestamp.toISOString().slice(0, 10);
      dailyDistance.set(dayKey, (dailyDistance.get(dayKey) || 0) + g.distanceFromPreviousPoint);
    }
    const distanceOverTime = Array.from(dailyDistance.entries()).map(([date, v]) => ({
      date,
      distance: Math.round(v * 10) / 10,
    }));

    // Traffic by zone
    const zones = await db.zone.findMany({
      orderBy: { estimatedTraffic: 'desc' },
      take: 20,
    });
    const trafficByZone = zones.map((z) => ({
      name: z.name,
      traffic: z.estimatedTraffic,
      pedestrian: z.estimatedFrequentation,
      vehicle: Math.round((z.estimatedTraffic + z.estimatedFrequentation) / 2),
    }));

    // Exposure by zone
    const exposureByZoneRaw = await db.exposureRecord.groupBy({
      by: ['zoneId'],
      where: { campaign: { companyId } },
      _avg: { exposureScore: true },
      orderBy: { _avg: { exposureScore: 'desc' } },
      take: 10,
    });
    const exposureByZone = await Promise.all(
      exposureByZoneRaw.map(async (z) => {
        const zone = await db.zone.findUnique({ where: { id: z.zoneId } });
        return {
          name: zone?.name || 'Unknown',
          score: Math.round((z._avg.exposureScore || 0) * 10) / 10,
        };
      })
    );

    // Campaign performance
    const campaigns = await db.campaign.findMany({
      where: { companyId },
      include: { _count: { select: { exposures: true } } },
    });
    const campaignPerformance = await Promise.all(
      campaigns.map(async (c) => {
        const avg = await db.exposureRecord.aggregate({
          where: { campaignId: c.id },
          _avg: { exposureScore: true },
        });
        return {
          name: c.name,
          score: Math.round((avg._avg.exposureScore || 0) * 10) / 10,
          count: c._count.exposures,
        };
      })
    );

    // AI prediction vs observed (hourly comparison)
    const predictions = await db.prediction.findMany({
      where: { createdAt: { gte: startDate } },
      select: { hour: true, predictedScore: true, zoneId: true },
    });
    const observations = await db.exposureRecord.groupBy({
      by: ['hour'],
      where: { campaign: { companyId } },
      _avg: { exposureScore: true },
    });
    const obsMap = new Map(observations.map((o) => [o.hour, o._avg.exposureScore || 0]));
    const predByHour = new Map<number, number[]>();
    for (const p of predictions) {
      if (!predByHour.has(p.hour)) predByHour.set(p.hour, []);
      predByHour.get(p.hour)!.push(p.predictedScore);
    }
    const predictionVsObserved = Array.from(predByHour.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, preds]) => ({
        hour: `${hour}:00`,
        predicted: Math.round((preds.reduce((a, b) => a + b, 0) / preds.length) * 10) / 10,
        observed: Math.round((obsMap.get(hour) || 0) * 10) / 10,
      }));

    return NextResponse.json({
      kpis: {
        activeCampaigns,
        activeVehicles,
        totalDistance: Math.round((totalDistance._sum.distanceFromPreviousPoint || 0) * 10) / 10,
        avgExposure: Math.round((avgExposure._avg.exposureScore || 0) * 10) / 10,
        bestZone: bestZoneName,
        optimizationGain,
      },
      charts: {
        exposureOverTime,
        distanceOverTime,
        trafficByZone,
        exposureByZone,
        campaignPerformance,
        predictionVsObserved,
      },
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
