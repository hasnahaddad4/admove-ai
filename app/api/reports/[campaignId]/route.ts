import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';
import { loadMetadata } from '@/lib/ml/model';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaignId } = await params;
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        company: true,
        vehicles: { include: { vehicle: true } },
      },
    });

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const totalDistance = await db.gpsPoint.aggregate({
      where: { campaignId },
      _sum: { distanceFromPreviousPoint: true },
    });

    const avgExposure = await db.exposureRecord.aggregate({
      where: { campaignId },
      _avg: { exposureScore: true },
    });

    const topZonesRaw = await db.exposureRecord.groupBy({
      by: ['zoneId'],
      where: { campaignId },
      _avg: { exposureScore: true },
      _count: true,
      orderBy: { _avg: { exposureScore: 'desc' } },
      take: 5,
    });
    const topZones = await Promise.all(
      topZonesRaw.map(async (z) => {
        const zone = await db.zone.findUnique({ where: { id: z.zoneId } });
        return {
          name: zone?.name || 'Unknown',
          city: zone?.city || '',
          avgScore: Math.round((z._avg.exposureScore || 0) * 10) / 10,
          count: z._count,
        };
      })
    );

    const topHours = await db.exposureRecord.groupBy({
      by: ['hour'],
      where: { campaignId },
      _avg: { exposureScore: true },
      orderBy: { _avg: { exposureScore: 'desc' } },
      take: 5,
    });

    const recommendations = await db.recommendation.findMany({
      where: { campaignId },
      include: { zone: true },
      orderBy: { priority: 'asc' },
      take: 5,
    });

    const modelMeta = loadMetadata();

    const report = {
      generatedAt: new Date().toISOString(),
      company: {
        name: campaign.company.name,
        industry: campaign.company.industry,
        address: campaign.company.address,
        city: campaign.company.city,
        country: campaign.company.country,
      },
      campaign: {
        name: campaign.name,
        description: campaign.description,
        product: campaign.product,
        targetAudience: campaign.targetAudience,
        startDate: campaign.startDate.toISOString().slice(0, 10),
        endDate: campaign.endDate.toISOString().slice(0, 10),
        budget: campaign.budget,
        status: campaign.status,
      },
      vehicles: campaign.vehicles.map((cv) => ({
        name: cv.vehicle.name,
        plateNumber: cv.vehicle.plateNumber,
        type: cv.vehicle.vehicleType,
        status: cv.vehicle.status,
      })),
      summary: {
        totalDistance: Math.round((totalDistance._sum.distanceFromPreviousPoint || 0) * 10) / 10,
        avgExposureScore: Math.round((avgExposure._avg.exposureScore || 0) * 10) / 10,
        vehicleCount: campaign.vehicles.length,
      },
      topZones,
      topHours: topHours.map((h) => ({
        hour: `${h.hour}:00`,
        avgScore: Math.round((h._avg.exposureScore || 0) * 10) / 10,
      })),
      recommendations: recommendations.map((r) => ({
        priority: r.priority,
        zone: r.zone.name,
        city: r.zone.city,
        recommendedHour: `${r.recommendedHour}:00`,
        score: r.score,
        reason: r.reason,
      })),
      model: modelMeta
        ? {
            name: modelMeta.name,
            version: modelMeta.version,
            algorithm: modelMeta.algorithm,
            mae: modelMeta.mae,
            rmse: modelMeta.rmse,
            r2: modelMeta.r2,
          }
        : null,
      limitations:
        'Exposure figures are estimates generated from available mobility and campaign data and should not be interpreted as exact counts of individuals exposed to the advertisement. This prototype uses simulated training data because real campaign exposure datasets are not publicly available.',
    };

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Report GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
