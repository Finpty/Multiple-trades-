import { jsonLdText, type JsonLd as JsonLdData } from "@/lib/site/seo";

/** Emits a structured-data script tag. Serialisation escapes "<" so content can never break out of the tag. */
export function JsonLd({ data }: { data: JsonLdData | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
