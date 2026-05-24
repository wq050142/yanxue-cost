import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: '此功能暂不可用，请登录后在设置中修改密码' }, { status: 400 });
}
