import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'yanxue-cost-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
export interface AuthUser { id: string; email: string; created_at: string; }
interface JWTPayload { userId: string; email: string; }
export async function hashPassword(password: string): Promise<string> { const salt = await bcrypt.genSalt(10); return bcrypt.hash(password, salt); }
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> { return bcrypt.compare(password, hashedPassword); }
export function generateToken(user: AuthUser): string { return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); }
export function verifyToken(token: string): JWTPayload | null { try { return jwt.verify(token, JWT_SECRET) as JWTPayload; } catch { return null; } }
export function getUserIdFromToken(token: string): string | null { const payload = verifyToken(token); return payload ? payload.userId : null; }
