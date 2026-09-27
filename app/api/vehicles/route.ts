import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const createVehicleSchema = z.object({
  name: z.string().min(2),
  plateNumber: z.string().min(3),
  vehicleType: z.enum(['TRUCK', 'VAN', 'CAR', 'BUS', 'SCOOTER']),
  status: z.enum(['ACTIVE', 'IDLE', 'MAINTENANCE']).optional().default('ACTIVE'),
  currentLatitude: z.number().optional().default(36.8065),
  currentLongitude: z.number().optional().default(10.1815),
});

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const vehicles = await db.vehicle.findMany({
      where: { companyId: auth.companyId || undefined },
      include: {
        campaigns: { include: { campaign: true } },
        _count: { select: { gpsPoints: true, exposures: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute total distance for each vehicle
    const vehiclesWithStats = await Promise.all(
      vehicles.map(async (v) => {
        const totalDistance = await db.gpsPoint.aggregate({
          where: { vehicleId: v.id },
          _sum: { distanceFromPreviousPoint: true },
        });
        const avgExposure = await db.exposureRecord.aggregate({
          where: { vehicleId: v.id },
          _avg: { exposureScore: true },
        });
        return {
          ...v,
          totalDistance: totalDistance._sum.distanceFromPreviousPoint || 0,
          avgExposure: avgExposure._avg.exposureScore || 0,
        };
      })
    );

    return NextResponse.json({ vehicles: vehiclesWithStats });
  } catch (error) {
    console.error('Vehicles GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'ADMIN', 'MANAGER');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const existingPlate = await db.vehicle.findFirst({
      where: { plateNumber: parsed.data.plateNumber },
    });
    if (existingPlate) {
      return NextResponse.json({ error: 'Plate number already exists' }, { status: 409 });
    }

    const vehicle = await db.vehicle.create({
      data: { ...parsed.data, companyId: auth.companyId! },
    });

    await logActivity(auth.userId, 'CREATE_VEHICLE', 'vehicle', vehicle.id, { name: vehicle.name });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error('Vehicle POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
