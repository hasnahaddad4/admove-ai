import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const zone = await db.zone.findUnique({
      where: { id },
      include: {
        trafficData: {
          orderBy: { date: 'desc' },
          take: 24 * 7, // last 7 days
        },
      },
    });

    if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 });

    const avgExposure = await db.exposureRecord.aggregate({
      where: { zoneId: id },
      _avg: { exposureScore: true },
    });

    const hourlyStats = await db.exposureRecord.groupBy({
      by: ['hour'],
      where: { zoneId: id },
      _avg: { exposureScore: true },
      orderBy: { hour: 'asc' },
    });

    const predictions = await db.prediction.findMany({
      where: { zoneId: id },
      orderBy: { hour: 'asc' },
    });

    return NextResponse.json({
      zone,
      avgExposure: avgExposure._avg.exposureScore || 0,
      hourlyStats: hourlyStats.map((h) => ({ hour: h.hour, avgScore: h._avg.exposureScore })),
      predictions,
    });
  } catch (error) {
    console.error('Zone GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
