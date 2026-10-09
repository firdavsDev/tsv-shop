import { notFound } from "next/navigation";

/** Unknown paths under /ru or /uz: render [locale]/not-found.tsx inside the site layout. */
export default function CatchAll() {
  notFound();
}
