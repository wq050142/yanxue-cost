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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const originalResult = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
    if (originalResult.rows.length === 0) return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
    const original = originalResult.rows[0];
    const result = await query(
      'INSERT INTO projects (user_id, name, type, remark, core_config, daily_expenses, other_expenses, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, original.name + ' (副本)', original.type, original.remark, original.core_config, original.daily_expenses, original.other_expenses, original.folder_id]
    );
    return NextResponse.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Copy project error:', err);
    return NextResponse.json({ error: '复制项目失败' }, { status: 500 });
  }
}
