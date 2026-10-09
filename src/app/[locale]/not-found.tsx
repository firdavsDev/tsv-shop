import Link from "next/link";

/** Not-found boundaries get no params, so this page is bilingual. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl">404</p>
      <h1 className="mt-4 text-lg">Страница не найдена · Sahifa topilmadi</h1>
      <Link href="/ru" className="label mt-8 inline-flex h-12 items-center bg-btn px-6 text-btn-fg">
        На главную · Bosh sahifa
      </Link>
    </div>
  );
}
