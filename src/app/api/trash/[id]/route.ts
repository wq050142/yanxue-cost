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
  if (id === 'batch') {
    try {
      const body = await request.json();
      const { projectIds } = body;
      if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
        return NextResponse.json({ error: '请选择要恢复的项目' }, { status: 400 });
      }
      const ph = projectIds.map((_: unknown, i: number) => '$' + (i + 2)).join(', ');
      const result = await query(
        'UPDATE projects SET deleted_at = NULL WHERE id IN (' + ph + ') AND user_id = $1 AND deleted_at IS NOT NULL',
        [userId, ...projectIds]
      );
      return NextResponse.json({ success: true, count: result.rowCount });
    } catch (err) {
      console.error('Batch restore error:', err);
      return NextResponse.json({ error: '批量恢复失败' }, { status: 500 });
    }
  }
  try {
    const result = await query('UPDATE projects SET deleted_at = NULL WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *', [id, userId]);
    if (result.rows.length === 0) return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
    return NextResponse.json({ success: true, project: result.rows[0] });
  } catch (err) {
    console.error('Restore project error:', err);
    return NextResponse.json({ error: '恢复项目失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const result = await query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rowCount === 0) return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Permanent delete error:', err);
    return NextResponse.json({ error: '永久删除失败' }, { status: 500 });
  }
}
