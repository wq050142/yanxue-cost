import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ user: null });
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null });
  }
  try {
    const result = await query('SELECT id, email, created_at FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ user: null });
    }
    const user = result.rows[0];
    return NextResponse.json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
