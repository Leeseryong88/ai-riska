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
  title: '안전보건계획서, 위험성평가 AI 자동화',
  description: '맞춤형 안전보건계획서 작성 및 위험성평가, 이제 AI로 자동화하세요. 계획서 수립부터 위험요소 분석 및 개선대책 수립까지 10초 만에 완료하는 안전관리 필수 솔루션입니다.',
  keywords: '안전보건계획서, 안전보건계획서 샘플, 안전보건계획서 양식, 위험성평가, AI 안전, 사업장 안전, 산업안전, 이미지 분석, Gemini AI, 안전진단, 안전감시단, 감시단, 안전관리자, 관리감독자, 보건관리자, 건설안전, 안전관리, 산업안전보건법, TBM, 위험요인, 안전점검, 스마트안전, 안전보고서, 위험성평가표, 아차사고, 안전교육',
  authors: [{ name: 'AI Riska' }],
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: '안전보건계획서, 위험성평가 AI 자동화',
    description: '맞춤형 안전보건계획서와 위험성평가를 AI로 스마트하게 자동화하세요. 효율적인 안전관리 솔루션을 제공합니다.',
    url: 'https://www.ai-riska.com',
    siteName: 'AI Riska',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '안전보건계획서 및 위험성평가 AI 자동화 시스템',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '안전보건계획서, 위험성평가 AI 자동화',
    description: 'AI가 실시간으로 안전보건계획서와 위험성평가를 분석하고 최적의 솔루션을 제안합니다.',
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