'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Sayfa yüklenemedi.</h1>
      <p>Beklenmeyen bir hata oluştu.</p>
      <button onClick={reset}>Yeniden dene</button>
    </main>
  );
}
