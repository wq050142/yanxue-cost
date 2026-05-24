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
    const result = await query('SELECT * FROM folders WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name ASC', [userId]);
    const folders = result.rows.map((f: Record<string, unknown>) => ({
      id: f.id, name: f.name, parentId: f.parent_id, createdAt: f.created_at, updatedAt: f.updated_at,
    }));
    return NextResponse.json({ folders });
  } catch (err) {
    console.error('Get folders error:', err);
    return NextResponse.json({ error: '获取文件夹列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, parentId } = body;
    if (!name?.trim()) return NextResponse.json({ error: '文件夹名称不能为空' }, { status: 400 });
    const result = await query('INSERT INTO folders (user_id, name, parent_id) VALUES ($1, $2, $3) RETURNING *', [userId, name.trim(), parentId || null]);
    const folder = result.rows[0];
    return NextResponse.json({ folder: { id: folder.id, name: folder.name, parentId: folder.parent_id, createdAt: folder.created_at, updatedAt: folder.updated_at } });
  } catch (err) {
    console.error('Create folder error:', err);
    return NextResponse.json({ error: '创建文件夹失败' }, { status: 500 });
  }
}
