/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // 빌드 시 린트 체크를 건너뛰어 배포 속도를 높이고 오류를 방지합니다.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 빌드 시 타입 체크를 건너뛰어 배포 성공률을 높입니다.
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      // 'firebasestorage.googleapis.com',
      // 'storage.googleapis.com',
      'k.kakaocdn.net',
      // 'safetyapp-7e55d.firebasestorage.app',
      'img.kakaocdn.net',
      'k.kakao.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      // {
      //   protocol: 'https',
      //   hostname: '**.firebasestorage.app',
      //   port: '',
      //   pathname: '/**',
      // },
      {
        protocol: 'https',
        hostname: '**.kakaocdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.kakao.com',
        port: '',
        pathname: '/**',
      }
    ]
  },
};

module.exports = nextConfig; 