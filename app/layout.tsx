import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './context/AuthContext';
import AuthGuard from '@/components/navigation/AuthGuard';

const inter = Inter({ subsets: ['latin'] });

/** 로컬 dev에서 metadataBase가 프로덕션 도메인이면 아이콘/OG용 내부 fetch가 원격 HTML을 받아 이미지 최적화가 실패함 */
function resolveMetadataBase(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.NODE_ENV !== 'production') {
    return new URL('http://localhost:3000');
  }
  return new URL('https://modu-safe.com');
}

const metadataBase = resolveMetadataBase();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase,
  title:
    '모두의 안전 | 위험성평가·안전보건계획서·안전관리 문서 AI — 안전관리자·중소기업',
  description:
    '위험성평가표·안전보건계획서·작업허가·안전일지 등 안전관리 문서를 AI로 맞춤 생성합니다. 안전관리자와 중소기업을 위해 양식 샘플 검색 없이 사업장에 맞는 초안을 빠르게 만드세요.',
  keywords:
    '위험성평가, 위험성평가표, 위험성평가 작성, 안전관리, 안전관리자, 안전담당자, 안전보건계획서, 안전보건교육, 산업안전보건, 중소기업 안전관리, 작업허가서, 일일안전일지, 현장 안전관리, 안전 문서, AI 안전, 모두의 안전',
  authors: [{ name: '모두의 안전' }],
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: '모두의 안전 | 안전관리계획서, 위험성평가표 생성 AI',
    description: '양식 샘플 찾지 말고 AI로 맞춤 생성하세요.',
    url: 'https://modu-safe.com/',
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
    title: '모두의 안전 | 안전관리계획서, 위험성평가표 생성 AI',
    description: '양식 샘플 찾지 말고 AI로 맞춤 생성하세요.',
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
    <html lang="ko" className="scroll-smooth">
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