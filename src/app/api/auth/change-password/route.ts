import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: '密码至少需要6个字符' }, { status: 400 });
    }
    const passwordHash = await hashPassword(newPassword);
    const result = await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, payload.userId]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: '密码修改失败' }, { status: 500 });
  }
}
