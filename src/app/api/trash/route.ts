import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function authenticate(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  return payload ? payload.userId : null;
}

export async function GET(request: NextRequest) {
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const result = await query(
      'SELECT id, name, type, remark, created_at, updated_at, deleted_at FROM projects WHERE user_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
      [userId]
    );
    const projects = result.rows.map((p: Record<string, unknown>) => ({
      id: p.id, name: p.name, type: p.type, remark: p.remark, createdAt: p.created_at, updatedAt: p.updated_at, deletedAt: p.deleted_at,
    }));
    return NextResponse.json({ projects });
  } catch (err) {
    console.error('Get trash error:', err);
    return NextResponse.json({ error: '获取回收站失败' }, { status: 500 });
  }
}
