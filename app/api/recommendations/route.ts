import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;

    const recommendations = await db.recommendation.findMany({
      where,
      include: {
        zone: true,
        campaign: { select: { name: true } },
      },
      orderBy: [{ campaignId: 'asc' }, { priority: 'asc' }],
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Recommendations GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
