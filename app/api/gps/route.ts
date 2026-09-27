import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const campaignId = searchParams.get('campaignId');
    const limit = parseInt(searchParams.get('limit') || '500');

    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (campaignId) where.campaignId = campaignId;

    const points = await db.gpsPoint.findMany({
      where,
      include: { vehicle: true },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 2000),
    });

    return NextResponse.json({ points });
  } catch (error) {
    console.error('GPS GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
