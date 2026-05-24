import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function authenticate(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  return payload ? payload.userId : null;
}

export async function POST(request: NextRequest) {
  const userId = authenticate(request);
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const body = await request.json();
    const { action, projectIds, targetFolderId } = body;
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: '请选择要操作的项目' }, { status: 400 });
    }
    switch (action) {
      case 'delete': {
        const ph = projectIds.map((_: unknown, i: number) => '$' + (i + 2)).join(', ');
        const result = await query(
          'UPDATE projects SET deleted_at = NOW() WHERE id IN (' + ph + ') AND user_id = $1 AND deleted_at IS NULL',
          [userId, ...projectIds]
        );
        return NextResponse.json({ success: true, count: result.rowCount });
      }
      case 'move': {
        const ph = projectIds.map((_: unknown, i: number) => '$' + (i + 3)).join(', ');
        const result = await query(
          'UPDATE projects SET folder_id = $2 WHERE id IN (' + ph + ') AND user_id = $1',
          [userId, targetFolderId || null, ...projectIds]
        );
        return NextResponse.json({ success: true, count: result.rowCount });
      }
      case 'copy': {
        const ph = projectIds.map((_: unknown, i: number) => '$' + (i + 2)).join(', ');
        const fetchResult = await query(
          'SELECT * FROM projects WHERE id IN (' + ph + ') AND user_id = $1',
          [userId, ...projectIds]
        );
        if (fetchResult.rows.length > 0) {
          await transaction(async (client) => {
            for (const p of fetchResult.rows) {
              const name = p.name + ' (副本)';
              const cfg = typeof p.core_config === 'string' ? p.core_config : JSON.stringify(p.core_config);
              const de = typeof p.daily_expenses === 'string' ? p.daily_expenses : JSON.stringify(p.daily_expenses);
              const oe = typeof p.other_expenses === 'string' ? p.other_expenses : JSON.stringify(p.other_expenses);
              await client.query(
                'INSERT INTO projects (user_id, name, type, remark, core_config, daily_expenses, other_expenses, folder_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                [userId, name, p.type, p.remark, cfg, de, oe, targetFolderId || p.folder_id]
              );
            }
          });
        }
        return NextResponse.json({ success: true, count: fetchResult.rows.length });
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (err) {
    console.error('Batch operation error:', err);
    return NextResponse.json({ error: '批量操作失败' }, { status: 500 });
  }
}
