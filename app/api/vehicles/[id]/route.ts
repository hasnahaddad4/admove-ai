import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  plateNumber: z.string().min(3).optional(),
  vehicleType: z.enum(['TRUCK', 'VAN', 'CAR', 'BUS', 'SCOOTER']).optional(),
  status: z.enum(['ACTIVE', 'IDLE', 'MAINTENANCE']).optional(),
  currentLatitude: z.number().optional(),
  currentLongitude: z.number().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const vehicle = await db.vehicle.findUnique({
      where: { id },
      include: {
        campaigns: { include: { campaign: true } },
      },
    });

    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    const totalDistance = await db.gpsPoint.aggregate({
      where: { vehicleId: id },
      _sum: { distanceFromPreviousPoint: true },
    });

    const avgExposure = await db.exposureRecord.aggregate({
      where: { vehicleId: id },
      _avg: { exposureScore: true },
    });

    const gpsPoints = await db.gpsPoint.findMany({
      where: { vehicleId: id },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    const exposures = await db.exposureRecord.findMany({
      where: { vehicleId: id },
      include: { zone: true },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      vehicle,
      stats: {
        totalDistance: totalDistance._sum.distanceFromPreviousPoint || 0,
        avgExposure: avgExposure._avg.exposureScore || 0,
        gpsPointsCount: gpsPoints.length,
      },
      gpsPoints,
      exposures,
    });
  } catch (error) {
    console.error('Vehicle GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN', 'MANAGER');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.vehicle.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    const vehicle = await db.vehicle.update({
      where: { id },
      data: parsed.data,
    });

    await logActivity(auth.userId, 'UPDATE_VEHICLE', 'vehicle', id, parsed.data);

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error('Vehicle PUT error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN', 'MANAGER');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const existing = await db.vehicle.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    await db.vehicle.delete({ where: { id } });
    await logActivity(auth.userId, 'DELETE_VEHICLE', 'vehicle', id, { name: existing.name });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vehicle DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
