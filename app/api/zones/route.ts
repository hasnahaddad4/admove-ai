import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zones = await db.zone.findMany({
      include: {
        _count: { select: { exposures: true, predictions: true } },
      },
      orderBy: { estimatedTraffic: 'desc' },
    });

    // Compute avg exposure and best hour for each zone
    const zonesWithStats = await Promise.all(
      zones.map(async (z) => {
        const avgExposure = await db.exposureRecord.aggregate({
          where: { zoneId: z.id },
          _avg: { exposureScore: true },
        });

        const hourlyStats = await db.exposureRecord.groupBy({
          by: ['hour'],
          where: { zoneId: z.id },
          _avg: { exposureScore: true },
          orderBy: { _avg: { exposureScore: 'desc' } },
          take: 1,
        });

        return {
          ...z,
          avgExposure: avgExposure._avg.exposureScore || 0,
          bestHour: hourlyStats[0]?.hour || 18,
        };
      })
    );

    return NextResponse.json({ zones: zonesWithStats });
  } catch (error) {
    console.error('Zones GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
