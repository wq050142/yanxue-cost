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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const result = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rows.length === 0) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    return NextResponse.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Get project error:', err);
    return NextResponse.json({ error: '获取项目失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, remark, core_config, daily_expenses, other_expenses, folderId } = body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(name); }
    if (remark !== undefined) { updates.push(`remark = $${paramIndex++}`); values.push(remark); }
    if (core_config !== undefined) { updates.push(`core_config = $${paramIndex++}`); values.push(JSON.stringify(core_config)); }
    if (daily_expenses !== undefined) { updates.push(`daily_expenses = $${paramIndex++}`); values.push(JSON.stringify(daily_expenses)); }
    if (other_expenses !== undefined) { updates.push(`other_expenses = $${paramIndex++}`); values.push(JSON.stringify(other_expenses)); }
    if (folderId !== undefined) { updates.push(`folder_id = $${paramIndex++}`); values.push(folderId); }
    if (updates.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(id);
    values.push(userId);
    const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} RETURNING *`;
    const result = await query(sql, values);
    if (result.rows.length === 0) return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
    return NextResponse.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Update project error:', err);
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const result = await query('UPDATE projects SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId]);
    if (result.rowCount === 0) return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete project error:', err);
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
