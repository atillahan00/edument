import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>Sayfa bulunamadı.</h1>
      <Link href="/login">Giriş sayfasına dön</Link>
    </main>
  );
}
