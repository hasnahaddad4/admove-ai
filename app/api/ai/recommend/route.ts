import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { predict, isModelAvailable } from '@/lib/ml/model';
import { ZONE_PROFILES } from '@/lib/ml/dataset';
import { getAuthFromRequest } from '@/lib/auth';

const recommendSchema = z.object({
  campaignId: z.string().optional(),
  city: z.string().optional(),
  topN: z.number().int().min(1).max(50).optional().default(10),
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
    const parsed = recommendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { campaignId, city, topN } = parsed.data;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const month = now.getMonth() + 1;

    // Evaluate all zones × all hours
    const recommendations: {
      zoneId: number;
      zoneName: string;
      city: string;
      category: string;
      hour: number;
      score: number;
      confidence: number;
      reason: string;
    }[] = [];

    for (const zp of ZONE_PROFILES) {
      if (city && zp.city !== city) continue;

      const zoneDb = await db.zone.findFirst({ where: { name: zp.zoneName } });
      const historicalExposure = Math.round((zp.baseTraffic * 0.4 + zp.basePedestrian * 0.6) * 0.85);

      let bestHour = 18;
      let bestScore = 0;
      let bestConfidence = 0;

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
          campaign_duration: 30,
          target_audience_match: 65,
          historical_exposure: historicalExposure,
          weather_factor: 1.0,
        });

        if (result.predicted_exposure_score > bestScore) {
          bestScore = result.predicted_exposure_score;
          bestHour = h;
          bestConfidence = result.confidence;
        }
      }

      // Generate reason
      const reasons: string[] = [];
      if (zp.baseTraffic > 70) reasons.push(`high traffic index (${zp.baseTraffic}/100)`);
      if (zp.basePedestrian > 70) reasons.push(`strong pedestrian activity (${zp.basePedestrian}/100)`);
      if (bestHour >= 16 && bestHour <= 20) reasons.push(`peak exposure window at ${bestHour}:00–${bestHour + 2}:00`);
      if (zp.category === 'COMMERCIAL' || zp.category === 'TOURIST')
        reasons.push(`${zp.category.toLowerCase()} zone with high audience potential`);
      if (bestScore > 80) reasons.push(`strong historical exposure correlation`);
      if (reasons.length === 0) reasons.push(`moderate exposure potential`);

      recommendations.push({
        zoneId: zp.zoneId,
        zoneName: zp.zoneName,
        city: zp.city,
        category: zp.category,
        hour: bestHour,
        score: Math.round(bestScore * 10) / 10,
        confidence: bestConfidence,
        reason: `Recommended due to ${reasons.join(', ')}.`,
      });
    }

    recommendations.sort((a, b) => b.score - a.score);
    const top = recommendations.slice(0, topN).map((r, i) => ({ ...r, priority: i + 1 }));

    // Persist recommendations
    if (campaignId) {
      await db.recommendation.deleteMany({ where: { campaignId } });
      for (const r of top) {
        const zoneDb = await db.zone.findFirst({ where: { name: r.zoneName } });
        if (zoneDb) {
          await db.recommendation.create({
            data: {
              campaignId,
              zoneId: zoneDb.id,
              recommendedHour: r.hour,
              score: r.score,
              reason: r.reason,
              priority: r.priority,
            },
          });
        }
      }
    }

    return NextResponse.json({
      recommendations: top,
      totalEvaluated: recommendations.length,
      campaignId: campaignId || null,
    });
  } catch (error) {
    console.error('AI recommend error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recommendation failed' },
      { status: 500 }
    );
  }
}
