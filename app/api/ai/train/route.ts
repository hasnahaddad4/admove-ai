import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';
import { trainAllModels } from '@/lib/ml/train';
import { loadMetadata } from '@/lib/ml/model';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (auth.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can retrain the model' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const datasetSize = parseInt(searchParams.get('datasetSize') || '10000');

    const result = trainAllModels(datasetSize);

    // Update ModelVersion in DB
    await db.modelVersion.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });

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
    }

    return NextResponse.json({
      success: true,
      bestAlgorithm: result.bestAlgorithm,
      metrics: result.metrics,
      datasetSize: result.datasetSize,
      featureImportance: result.featureImportance,
    });
  } catch (error) {
    console.error('AI train error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Training failed' },
      { status: 500 }
    );
  }
}
