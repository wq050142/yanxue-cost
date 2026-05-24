import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker 部署需要 standalone 输出
  output: 'standalone',
  
  allowedDevOrigins: ['*.dev.coze.site', 'yanxue-cost.cn', '*.yanxue-cost.cn'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
  // 将 Supabase 环境变量暴露给客户端
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.COZE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.COZE_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
