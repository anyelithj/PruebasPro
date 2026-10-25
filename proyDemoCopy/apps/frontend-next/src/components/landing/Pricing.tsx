import Link from "next/link";
import type { Dictionary } from "@aula/shared-i18n";
// [Pricing · Sprint 7.13]: planes (gratis / pago único por curso) y métodos de pago (tarjeta Stripe, ETH Sepolia) | [Patrón]: Presentational Component + Data-driven rendering | [Principio]: SRP + honestidad (aviso de entorno de demostración) | [Paradigma]: Declarativo
// [CTA]: /register?plan=free · el plan «curso» lleva al catálogo (cada curso tiene su precio)

export function Pricing({ l }: { l: Dictionary["landing"] }) {
  return (
    <section className="section" id="planes" aria-labelledby="planes-title" style={{ background: "var(--bg-alt)" }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{l.pricingEyebrow}</span>
          <h2 id="planes-title">{l.pricingTitle}</h2>
          <p>{l.pricingLead}</p>
        </div>
        <ul className="roles-grid list-none p-0">
          {l.plans.map((p) => (
            <li key={p.id} className="role-card">
              <span className="badge">{p.name}</span>
              <h3>{p.price}</h3>
              <p className="text-sm text-[var(--text-muted)]">{p.text}</p>
              <ul>
                {p.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              <Link href={p.id === "free" ? "/register?plan=free" : "/courses"} className="btn btn-primary btn-block">
                {p.cta}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">{l.paymentNote}</p>
      </div>
    </section>
  );
}
