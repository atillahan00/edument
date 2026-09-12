import type { Metadata } from 'next';
import './globals.css';
import { ValidationMessages } from '../components/validation-messages';
export const metadata: Metadata = {
  title: 'BILSEM-Chain | Gelişim ve Mentorluk',
  description: 'Özel öğrenci gelişim kayıtları, doğrulanabilir başarılar ve açıklanabilir mentor önerileri.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <ValidationMessages />
        {children}
      </body>
    </html>
  );
}
