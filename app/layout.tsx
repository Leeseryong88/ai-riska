import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './context/AuthContext';
import AuthGuard from '@/components/navigation/AuthGuard';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ai-riska.com'),
  title: '모두의 안전 | 컨설팅·양식 검색 없이 우리 회사 맞춤 안전 서류',
  description:
    '비싼 컨설팅이나 인터넷 샘플 찾기 대신, 모두의 안전에서 우리 사업장 정보로 안전보건계획서·위험성평가·일지·허가 초안을 직접 만드세요.',
  keywords:
    '모두의 안전, 안전관리, 초보 안전관리자, 안전담당자, 중소기업 안전관리, 위험성평가, 안전보건계획서, 작업허가서, 일일 안전일지, AI 안전, 현장 안전관리, 산업안전, 안전 문서 자동화, 현장 점검',
  authors: [{ name: '모두의 안전' }],
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: '모두의 안전 | 우리 회사에 맞는 안전 서류를 직접',
    description:
      '컨설팅 비용·남의 양식 복사 대신 AI와 실무 도구로 계획서·위험성평가·현장 기록을 맞춤 작성하세요.',
    url: 'https://www.ai-riska.com',
    siteName: '모두의 안전',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '모두의 안전 실무형 안전관리 플랫폼',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '모두의 안전 | 샘플 찾지 말고 맞춤 서류',
    description:
      '안전보건계획서 양식·위험성평가 샘플 검색 대신, 우리 회사 조건에 맞는 문서 초안을 바로 만드세요.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <AuthGuard>
            <main className="min-h-screen bg-gray-100">
              {children}
            </main>
          </AuthGuard>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
} 