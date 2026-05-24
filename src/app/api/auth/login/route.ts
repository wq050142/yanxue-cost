import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }
    const result = await query('SELECT id, email, password_hash, created_at FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }
    const user = result.rows[0];
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }
    const token = generateToken({ id: user.id, email: user.email, created_at: user.created_at });
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, created_at: user.created_at },
      session: { access_token: token, user: { id: user.id, email: user.email, created_at: user.created_at } },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
  }
}
