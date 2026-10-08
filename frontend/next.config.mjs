/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Gói icon rất lớn: chỉ biên dịch/nạp những icon được import (nhanh hơn khi dev, nhẹ hơn khi build)
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  // Cho phép build/chạy bản thử ở thư mục riêng, không đụng `next dev` đang chạy
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
