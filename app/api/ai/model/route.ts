import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loadMetadata, isModelAvailable } from '@/lib/ml/model';
import { getAuthFromRequest } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isModelAvailable()) {
      return NextResponse.json(
        { error: 'ML model not available. Please train the model first.' },
        { status: 503 }
      );
    }

    const metadata = loadMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Model metadata not found' }, { status: 404 });
    }

    // Load the dataset to provide sample predictions for charts
    const datasetPath = path.join(process.cwd(), 'ml', 'data', 'exposure_dataset.csv');
    let actualVsPredicted: { actual: number; predicted: number }[] = [];
    let residuals: number[] = [];

    if (fs.existsSync(datasetPath)) {
      const content = fs.readFileSync(datasetPath, 'utf-8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',');
      const sampleSize = 500;
      const step = Math.max(1, Math.floor((lines.length - 1) / sampleSize));

      const { predict } = await import('@/lib/ml/model');
      for (let i = 1; i < lines.length && actualVsPredicted.length < sampleSize; i += step) {
        const values = lines[i].split(',');
        const row: any = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = headers[j] === 'zone_category' ? values[j] : Number(values[j]);
        }
        try {
          const pred = predict({
            zone_id: row.zone_id,
            hour: row.hour,
            day_of_week: row.day_of_week,
            month: row.month,
            traffic_index: row.traffic_index,
            pedestrian_index: row.pedestrian_index,
            vehicle_index: row.vehicle_index,
            average_speed: row.average_speed,
            distance: row.distance,
            campaign_duration: row.campaign_duration,
            target_audience_match: row.target_audience_match,
            historical_exposure: row.historical_exposure,
            weather_factor: row.weather_factor,
          });
          actualVsPredicted.push({
            actual: row.exposure_score,
            predicted: pred.predicted_exposure_score,
          });
          residuals.push(row.exposure_score - pred.predicted_exposure_score);
        } catch {}
      }
    }

    // Residual distribution (histogram)
    const numBins = 20;
    const minRes = Math.min(...residuals, -20);
    const maxRes = Math.max(...residuals, 20);
    const binSize = (maxRes - minRes) / numBins;
    const residualBins = Array.from({ length: numBins }, (_, i) => ({
      bin: Math.round((minRes + i * binSize + binSize / 2) * 10) / 10,
      count: 0,
    }));
    for (const r of residuals) {
      let idx = Math.floor((r - minRes) / binSize);
      if (idx >= numBins) idx = numBins - 1;
      if (idx < 0) idx = 0;
      residualBins[idx].count++;
    }

    return NextResponse.json({
      model: {
        name: metadata.name,
        version: metadata.version,
        algorithm: metadata.algorithm,
        mae: metadata.mae,
        rmse: metadata.rmse,
        r2: metadata.r2,
        trainedAt: metadata.trainedAt,
        datasetSize: metadata.datasetSize,
        trainSize: metadata.trainSize,
        testSize: metadata.testSize,
        featureCount: metadata.featureCount,
      },
      features: metadata.featureImportance.sort((a, b) => b.importance - a.importance),
      allMetrics: metadata.allMetrics,
      actualVsPredicted: actualVsPredicted.slice(0, 200),
      residualDistribution: residualBins,
    });
  } catch (error) {
    console.error('AI model GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
