import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink"; // [Reutilización]: el «Volver» único que recuerda los filtros de /resources
import { ResourcePreview } from "@/components/curriculum/ResourcePreview";
import { findInChart, PhonemeSheet } from "@/components/curriculum/PhonemeSheet"; // [2026-11-14]: la ficha del fonema es un componente → Gestión usa la MISMA
import { phonemeTopic } from "@/config/ipa-chart";
import { listCurriculum } from "@/lib/curriculum-api";
import { isLanguage } from "@/lib/languages";
import { backLabel, type CurriculumItem } from "@/types/curriculum";
import type { Language } from "@/types/quiz";
// [Página /resources/fonema · 2026-10-27]: DETALLE de un fonema al pulsar su tarjeta en Recursos › Pronunciación — explicación, posición de la boca, 10 palabras con IPA y traducción,
// frases, pares mínimos, errores típicos de hispanohablantes y las fichas publicadas por los docentes para ese fonema
// [Patrón]: Container (RSC) + Presentational (PhonemeSheet) + URL State (?language=en&p=ʃ) | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [Por qué query y no /fonema/[símbolo]]: los símbolos IPA («ʃ», «tʃ», «ɑ̃») llevan diacríticos combinantes → en la query viajan codificados igual que /resources/tema

export const metadata: Metadata = { title: "Sonido del alfabeto fonético", robots: { index: false, follow: false } }; // Privada del portal
export const dynamic = "force-dynamic"; // Depende de la sesión (fichas del docente) y de la query

interface SearchParams {
  language?: string;
  p?: string; // Símbolo IPA sin barras
}

export default async function PhonemePage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const language: Language = isLanguage(sp.language) ? (sp.language as Language) : "en";
  const found = sp.p ? findInChart(language, sp.p) : null;
  if (!found) notFound(); // `notFound()` (Next.js): corta el render y muestra la 404 del portal

  // [Fichas del docente]: recursos de Pronunciación publicados cuyo TEMA es este fonema («/ʃ/ · she») | fallo → sin bloque (nunca rompe la página)
  let teacherItems: CurriculumItem[] = [];
  try {
    teacherItems = (await listCurriculum({ topic: phonemeTopic(found.phoneme), language, kind: "pronunciation", status: "approved", limit: 20 })).data;
  } catch {
    teacherItems = [];
  }

  return (
    <div className="fade-in w-full space-y-5 py-4">
      <BackLink href={`/resources?${new URLSearchParams({ kind: "pronunciation", language })}`} memo="resources">
        {backLabel("pronunciation")}
      </BackLink>
      <PhonemeSheet
        language={language}
        topic={found.topic}
        phoneme={found.phoneme}
        items={
          teacherItems.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {teacherItems.map((it) => (
                <li key={it.id} className="rounded-xl border border-border bg-card p-3" lang={it.language}>
                  <ResourcePreview kind={it.kind} content={it.content} language={it.language} />
                </li>
              ))}
            </ul>
          )
        }
      />
    </div>
  );
}
