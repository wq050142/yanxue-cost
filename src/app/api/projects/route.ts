import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { DEFAULT_CORE_CONFIG, DEFAULT_OTHER_EXPENSES } from '@/types';

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
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  try {
    let sql: string;
    let params: unknown[];
    if (folderId) {
      sql = `SELECT id, name, type, remark, created_at, updated_at, folder_id FROM projects WHERE user_id = $1 AND deleted_at IS NULL AND folder_id = $2 ORDER BY updated_at DESC`;
      params = [userId, folderId];
    } else {
      sql = `SELECT id, name, type, remark, created_at, updated_at, folder_id FROM projects WHERE user_id = $1 AND deleted_at IS NULL AND folder_id IS NULL ORDER BY updated_at DESC`;
      params = [userId];
    }
    const result = await query(sql, params);
    const projects = result.rows.map((p: Record<string, unknown>) => ({
      id: p.id, name: p.name, type: p.type, remark: p.remark, folderId: p.folder_id, createdAt: p.created_at, updatedAt: p.updated_at,
    }));
    return NextResponse.json({ projects });
  } catch (err) {
    console.error('Get projects error:', err);
    return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, type, remark, folderId } = body;
    if (!name || !type) return NextResponse.json({ error: '项目名称和类型不能为空' }, { status: 400 });
    const result = await query(
      `INSERT INTO projects (user_id, name, type, remark, core_config, daily_expenses, other_expenses, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, name, type, remark || '', JSON.stringify(DEFAULT_CORE_CONFIG), JSON.stringify([]), JSON.stringify(DEFAULT_OTHER_EXPENSES), folderId || null]
    );
    const project = result.rows[0];
    return NextResponse.json({ project: { id: project.id, name: project.name, type: project.type, remark: project.remark, folderId: project.folder_id, createdAt: project.created_at, updatedAt: project.updated_at } });
  } catch (err) {
    console.error('Create project error:', err);
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
  }
}
