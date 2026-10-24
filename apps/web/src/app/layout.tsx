import type { Metadata } from 'next';
import './globals.css';
import { designInit } from '../lib/design';
import { ValidationMessages } from '../components/validation-messages';
export const metadata: Metadata = {
  title: 'EduMent | Gelişim ve Mentorluk',
  description: 'Özel öğrenci gelişim kayıtları, doğrulanabilir başarılar ve açıklanabilir mentor önerileri.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-design="ultra" suppressHydrationWarning>
      <head>
        <script id="design-init" dangerouslySetInnerHTML={{ __html: designInit }} />
      </head>
      <body>
        <ValidationMessages />
        {children}
      </body>
    </html>
  );
}
