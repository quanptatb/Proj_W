import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UltraPic HD - Trích Xuất & Phục Hồi Ảnh Gốc Siêu Nét',
  description: 'Bóc tách ảnh gốc độ phân giải cao nhất từ Pinterest, Facebook, Web bất kỳ và làm nét phục hồi ảnh bị mờ, vỡ hạt với AI Upscaler.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
