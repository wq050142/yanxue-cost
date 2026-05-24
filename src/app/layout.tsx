import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '研学旅行成本核算工具',
    template: '%s | 研学旅行成本核算',
  },
  description:
    '专业的研学旅行成本核算及报价工具，支持项目管理、费用计算、利润分析和报价导出。',
  keywords: [
    '研学旅行',
    '成本核算',
    '报价工具',
    '项目管理',
    '费用计算',
    '利润分析',
  ],
  authors: [{ name: '研学旅行成本核算团队' }],
  openGraph: {
    title: '研学旅行成本核算工具',
    description: '专业的研学旅行成本核算及报价工具，支持项目管理、费用计算、利润分析和报价导出。',
    type: 'website',
    locale: 'zh_CN',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <AuthProvider>
          {isDev && <Inspector />}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
