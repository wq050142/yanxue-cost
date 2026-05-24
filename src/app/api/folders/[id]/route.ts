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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, parentId } = body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    if (name !== undefined) { updates.push('name = $' + paramIndex++); values.push(name); }
    if (parentId !== undefined) { updates.push('parent_id = $' + paramIndex++); values.push(parentId); }
    if (updates.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(id); values.push(userId);
    const sql = 'UPDATE folders SET ' + updates.join(', ') + ' WHERE id = $' + paramIndex++ + ' AND user_id = $' + paramIndex++ + ' AND deleted_at IS NULL RETURNING *';
    const result = await query(sql, values);
    if (result.rows.length === 0) return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
    const folder = result.rows[0];
    return NextResponse.json({ folder: { id: folder.id, name: folder.name, parentId: folder.parent_id, createdAt: folder.created_at, updatedAt: folder.updated_at } });
  } catch (err) {
    console.error('Update folder error:', err);
    return NextResponse.json({ error: '更新文件夹失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const result = await query('UPDATE folders SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId]);
    if (result.rowCount === 0) return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
    await query('UPDATE projects SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2', [id, userId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete folder error:', err);
    return NextResponse.json({ error: '删除文件夹失败' }, { status: 500 });
  }
}
