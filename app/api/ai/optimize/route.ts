import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { predict, isModelAvailable } from '@/lib/ml/model';
import { ZONE_PROFILES } from '@/lib/ml/dataset';
import { getAuthFromRequest } from '@/lib/auth';

const optimizeSchema = z.object({
  campaignId: z.string(),
  numVehicles: z.number().int().min(1).max(20).optional().default(3),
  duration: z.number().int().min(1).max(365).optional().default(30),
  targetAudience: z.string().optional().default('General'),
  preferredCity: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isModelAvailable()) {
      return NextResponse.json(
        { error: 'ML model not available. Please train the model first.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = optimizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { campaignId, numVehicles, duration, targetAudience, preferredCity } = parsed.data;

    // Get campaign's current average exposure (current strategy)
    const currentExposures = await db.exposureRecord.aggregate({
      where: { campaignId },
      _avg: { exposureScore: true },
    });
    const currentStrategy = currentExposures._avg.exposureScore || 0;

    // Simulate optimized strategy: evaluate top zones at best hours
    const now = new Date();
    const dayOfWeek = now.getDay();
    const month = now.getMonth() + 1;

    const audienceBoost = targetAudience.toLowerCase().includes('young') ? 5 : 0;

    let optimizedSum = 0;
    let evaluatedZones = 0;
    const zoneScores: { zone: string; score: number; hour: number }[] = [];

    for (const zp of ZONE_PROFILES) {
      if (preferredCity && zp.city !== preferredCity) continue;

      const historicalExposure = Math.round((zp.baseTraffic * 0.4 + zp.basePedestrian * 0.6) * 0.85);
      let bestHour = 18;
      let bestScore = 0;

      for (let h = 6; h <= 22; h++) {
        const hourFactor =
          Math.exp(-Math.pow(h - 8.5, 2) / 4) * 0.6 +
          Math.exp(-Math.pow(h - 18.5, 2) / 5) * 0.7 +
          0.35;
        const trafficIdx = Math.min(100, Math.max(10, Math.round(zp.baseTraffic * hourFactor)));
        const pedIdx = Math.min(100, Math.max(10, Math.round(zp.basePedestrian * hourFactor)));
        const vehIdx = Math.min(100, Math.max(10, Math.round(zp.baseVehicle * hourFactor)));

        const result = predict({
          zone_id: zp.zoneId,
          hour: h,
          day_of_week: dayOfWeek,
          month,
          traffic_index: trafficIdx,
          pedestrian_index: pedIdx,
          vehicle_index: vehIdx,
          average_speed: Math.round(Math.max(5, 50 - trafficIdx * 0.35)),
          distance: 25,
          campaign_duration: duration,
          target_audience_match: 65 + audienceBoost,
          historical_exposure: historicalExposure,
          weather_factor: 1.0,
        });

        if (result.predicted_exposure_score > bestScore) {
          bestScore = result.predicted_exposure_score;
          bestHour = h;
        }
      }

      optimizedSum += bestScore;
      evaluatedZones++;
      zoneScores.push({ zone: zp.zoneName, score: Math.round(bestScore * 10) / 10, hour: bestHour });
    }

    // Optimized strategy = average of top 5 zones
    zoneScores.sort((a, b) => b.score - a.score);
    const topZones = zoneScores.slice(0, 5);
    const optimizedStrategy =
      topZones.length > 0
        ? topZones.reduce((s, z) => s + z.score, 0) / topZones.length
        : 0;

    // Scale by vehicle count (more vehicles = better coverage, diminishing returns)
    const vehicleMultiplier = 1 + Math.min(0.15, (numVehicles - 1) * 0.03);
    const optimizedFinal = Math.min(100, optimizedStrategy * vehicleMultiplier);

    const improvement =
      currentStrategy > 0
        ? Math.round(((optimizedFinal - currentStrategy) / currentStrategy) * 1000) / 10
        : 0;

    return NextResponse.json({
      currentStrategy: {
        score: Math.round(currentStrategy * 10) / 10,
        description: `Current average exposure score based on ${numVehicles} vehicles over ${duration} days`,
      },
      optimizedStrategy: {
        score: Math.round(optimizedFinal * 10) / 10,
        description: `AI-optimized strategy focusing on top zones at peak hours with ${numVehicles} vehicles`,
        topZones: topZones.map((z, i) => ({
          ...z,
          priority: i + 1,
        })),
      },
      potentialImprovement: improvement,
      note: 'Estimated improvement in exposure potential score. Not a guarantee of actual ROI.',
    });
  } catch (error) {
    console.error('AI optimize error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Optimization failed' },
      { status: 500 }
    );
  }
}
