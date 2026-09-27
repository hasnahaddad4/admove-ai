/**
 * Authentication utilities — JWT + bcrypt password hashing.
 * Roles: ADMIN | MANAGER | EMPLOYEE
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const JWT_SECRET = process.env.JWT_SECRET || 'admove-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '7d';

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export const ALL_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      companyId: decoded.companyId,
    };
  } catch {
    return null;
  }
}

/**
 * Extract and verify the JWT from the Authorization header.
 * Returns null if missing/invalid.
 */
export function getAuthFromRequest(request: Request): JwtPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

/**
 * Require authentication. Returns the payload or a 401 response.
 */
export function requireAuth(request: NextRequest): JwtPayload | NextResponse {
  const auth = getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return auth;
}

/**
 * Require a specific role. Returns the payload or a 401/403 response.
 */
export function requireRole(request: NextRequest, ...roles: UserRole[]): JwtPayload | NextResponse {
  const auth = getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!roles.includes(auth.role)) {
    return NextResponse.json(
      { error: `Forbidden: requires ${roles.join(' or ')} role` },
      { status: 403 }
    );
  }
  return auth;
}

/**
 * Helper: is the auth payload of a given role?
 */
export function hasRole(auth: JwtPayload, ...roles: UserRole[]): boolean {
  return roles.includes(auth.role);
}
