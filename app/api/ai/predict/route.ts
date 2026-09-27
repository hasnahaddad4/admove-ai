import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { predict, isModelAvailable } from '@/lib/ml/model';
import { ZONE_PROFILES } from '@/lib/ml/dataset';
import { getAuthFromRequest } from '@/lib/auth';

const predictSchema = z.object({
  zone_id: z.number().int().min(1).max(20),
  hour: z.number().int().min(0).max(23),
  day_of_week: z.number().int().min(0).max(6).optional(),
  month: z.number().int().min(1).max(12).optional(),
  traffic_index: z.number().min(0).max(100),
  pedestrian_index: z.number().min(0).max(100),
  vehicle_index: z.number().min(0).max(100),
  average_speed: z.number().min(0).optional().default(25),
  distance: z.number().min(0).optional().default(25),
  campaign_duration: z.number().min(1).optional().default(30),
  target_audience_match: z.number().min(0).max(100).optional().default(65),
  historical_exposure: z.number().min(0).max(100).optional().default(60),
  weather_factor: z.number().min(0).max(1).optional().default(1.0),
  campaignId: z.string().optional(),
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
    const parsed = predictSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date();
    const input = {
      zone_id: data.zone_id,
      hour: data.hour,
      day_of_week: data.day_of_week ?? now.getDay(),
      month: data.month ?? now.getMonth() + 1,
      traffic_index: data.traffic_index,
      pedestrian_index: data.pedestrian_index,
      vehicle_index: data.vehicle_index,
      average_speed: data.average_speed,
      distance: data.distance,
      campaign_duration: data.campaign_duration,
      target_audience_match: data.target_audience_match,
      historical_exposure: data.historical_exposure,
      weather_factor: data.weather_factor,
    };

    const result = predict(input);

    // Persist prediction
    const zoneProfile = ZONE_PROFILES.find((z) => z.zoneId === data.zone_id);
    const zone = await db.zone.findFirst({
      where: { name: zoneProfile?.zoneName },
    });

    if (zone) {
      await db.prediction.create({
        data: {
          campaignId: data.campaignId || null,
          zoneId: zone.id,
          predictionDate: now,
          hour: data.hour,
          predictedScore: result.predicted_exposure_score,
          confidence: result.confidence,
          modelVersion: result.model_version,
        },
      });
    }

    return NextResponse.json({
      predicted_exposure_score: result.predicted_exposure_score,
      confidence: result.confidence,
      model_version: result.model_version,
      algorithm: result.algorithm,
      features_used: result.features_used,
      input,
    });
  } catch (error) {
    console.error('AI predict error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Prediction failed' },
      { status: 500 }
    );
  }
}
