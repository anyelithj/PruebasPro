"use client"; // [Next.js]: Client Component → menús interactivos, carrito y notificaciones
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, CreditCard, GraduationCap, Search, ShoppingCart, TrendingUp, UserRound, Wallet } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { NOTIFICATIONS_STREAM, useSSE } from "@/hooks/useSSE"; // [Sprint 6.2]: avisos en tiempo real por Server-Sent Events
import { fmt, INTL_LOCALE } from "@aula/shared-i18n";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Dropdown } from "./Dropdown";
import { LanguageMenu, ThemeMenu } from "./PortalToolbar";
import { MobileNavButton } from "./MobileNav"; // [Hamburguesa]: abre el sidebar en < lg (el botón de contraer vive en la cabecera del sidebar)
// [PortalTopbar]: barra superior del portal como NeuroLearning — buscador · notificaciones · carrito · tema · idioma · menú de perfil | [Patrón]: Composite (compone menús independientes) | [Principio]: SRP (cada menú en su componente) + DRY (todos sobre Dropdown) | [Paradigma]: Declarativo + Reactivo

// `export interface` (TS): datos del usuario que el layout (servidor) ya conoce desde el JWT
export interface TopbarUser {
  name: string;
  email: string;
  roleLabel: string;
  initials: string;
  gradient: string; // Degradado del avatar según el rol
}

// ── Buscador ── `<form method="get" action="/courses">` nativo: funciona sin JS y deja la búsqueda en la URL
function TopbarSearch() {
  const { t } = usePreferences();
  return (
    <form action="/courses" method="get" role="search" className="relative order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1 md:max-w-sm">
      <label htmlFor="topbar-search" className="sr-only">
        {t.topbar.searchLabel}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input id="topbar-search" name="search" type="search" placeholder={t.topbar.search} className="control w-full rounded-full pl-9" />
    </form>
  );
}

// `interface` (TS): forma de GET /api/notifications
interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  payload?: { href?: string } | null;
}

// [Globo contador]: accesible como texto oculto + número visible | reutilizado por notificaciones y carrito | [Principio]: DRY
function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white" aria-hidden>
      {n > 9 ? "9+" : n}
    </span>
  );
}

// ── Notificaciones ──
function NotificationsMenu() {
  const { t, locale } = usePreferences();
  const [data, setData] = useState<{ items: NotificationItem[]; unread: number } | null>(null);
  const [error, setError] = useState(false);

  // [load]: GET al BFF | `useCallback` (React): referencia estable para el efecto y para onOpen
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as { items: NotificationItem[]; unread: number });
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // [Carga inicial]: el contador aparece sin abrir el menú | setState solo dentro de callbacks asíncronos (`.then`) | `alive`: ignora la respuesta si el componente se desmontó
  useEffect(() => {
    let alive = true;
    fetch("/api/notifications")
      .then((r) => (r.ok ? (r.json() as Promise<{ items: NotificationItem[]; unread: number }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  // [Tiempo real · Sprint 6.2]: cada aviso nuevo entra arriba y suma al contador sin recargar | dedupe por `id` → el reenvío por Last-Event-ID no duplica | [Patrón]: Observer
  useSSE<NotificationItem>(NOTIFICATIONS_STREAM, "notification", (n) =>
    setData((prev) => {
      if (prev?.items.some((i) => i.id === n.id)) return prev;
      return { items: [n, ...(prev?.items ?? [])], unread: (prev?.unread ?? 0) + (n.isRead ? 0 : 1) };
    }),
  );

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    await load();
  };

  const unread = data?.unread ?? 0;
  return (
    <Dropdown
      label={`${t.topbar.notifications}${unread ? ` (${unread})` : ""}`}
      trigger={<Bell className="size-4" aria-hidden />}
      triggerClassName="size-9 justify-center"
      badge={<CountBadge n={unread} />}
      panelRole="dialog"
      panelClassName="w-80 max-w-[calc(100vw-2rem)]"
      onOpen={() => void load()}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <b className="text-sm">{t.topbar.notifications}</b>
            {unread > 0 && (
              <button type="button" onClick={() => void markAll()} className="text-[11px] font-semibold text-primary hover:underline">
                {t.topbar.markAllRead}
              </button>
            )}
          </div>
          {error ? (
            <p className="px-4 py-6 text-center text-xs text-tone-danger">{t.topbar.notificationsError}</p>
          ) : !data?.items.length ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t.topbar.noNotifications}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {data.items.map((n) => {
                // `toLocaleString` (ECMA-402): fecha en el formato del idioma activo
                const body = (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="no leída" />}
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{n.body}</span>
                    <time dateTime={n.createdAt} className="mt-1 block text-[10px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString(INTL_LOCALE[locale])}
                    </time>
                  </>
                );
                return (
                  <li key={n.id} className="border-b border-border last:border-0">
                    {n.payload?.href ? (
                      <Link href={n.payload.href} onClick={close} className="block px-4 py-2.5 text-foreground hover:bg-muted">
                        {body}
                      </Link>
                    ) : (
                      <div className="px-4 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {/* [Bandeja completa]: pantalla Angular /notificaciones (rewrite) → <a> con navegación completa, no <Link> */}
          <a href="/notificaciones" onClick={close} className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted">
            {t.topbar.viewAll}
          </a>
        </div>
      )}
    </Dropdown>
  );
}

// ── Carrito ──
function CartMenu() {
  const { t, locale } = usePreferences();
  const { items, remove, total, currency } = useCart();
  // `Intl.NumberFormat` (ECMA-402): moneda con formato del idioma (stdlib)
  const money = (v: number) => new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency }).format(v);
  return (
    <Dropdown
      label={`${t.topbar.cart}${items.length ? ` (${items.length})` : ""}`}
      trigger={<ShoppingCart className="size-4" aria-hidden />}
      triggerClassName="size-9 justify-center"
      badge={<CountBadge n={items.length} />}
      panelRole="dialog"
      panelClassName="w-80 max-w-[calc(100vw-2rem)]"
    >
      {(close) => (
        <div>
          <div className="border-b border-border px-4 py-2.5">
            <b className="text-sm"><ShoppingCart aria-hidden className="inline size-4 align-[-0.125em]" /> {t.topbar.cart}</b>
          </div>
          {!items.length ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t.topbar.cartEmpty}</p>
          ) : (
            <>
              <ul className="max-h-72 overflow-y-auto">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 border-b border-border px-4 py-2.5 last:border-0">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
                    <Link href={i.href} onClick={close} className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:text-primary">
                      {i.title}
                    </Link>
                    <span className="eeg-mono text-xs">{money(i.price)}</span>
                    <button type="button" onClick={() => remove(i.id)} aria-label={fmt(t.topbar.remove, { title: i.title })} className="btn btn-ghost btn-sm px-2! text-tone-danger">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 border-t border-border px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span>{t.topbar.total}</span>
                  <b className="eeg-mono">{money(total)}</b>
                </div>
                {/* [Sprint 7.4]: el pago vive en la pantalla Angular /checkout (Stripe embebido) → <a> con navegación completa (rewrite), no <Link> */}
                <a href="/checkout" onClick={close} aria-describedby="checkout-soon" className="btn btn-primary btn-sm w-full">
                  {t.topbar.checkout}
                </a>
                <p id="checkout-soon" className="text-center text-[10px] text-muted-foreground">
                  {t.topbar.checkoutSoon}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}

// ── Menú de perfil ──
function ProfileMenu({ user }: { user: TopbarUser }) {
  const { t } = usePreferences();
  const item = "block px-4 py-2 text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";
  return (
    <Dropdown
      label={t.topbar.profileMenu}
      triggerClassName="py-1 pl-1 pr-2.5"
      trigger={
        <>
          <span className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: user.gradient }} aria-hidden>
            {user.initials}
          </span>
          <span className="hidden max-w-28 truncate lg:inline">{user.name}</span>
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </>
      }
      panelClassName="w-60"
    >
      {(close) => (
        <div>
          <div className="border-b border-border px-4 py-3">
            <b className="block truncate text-sm">{user.name}</b>
            <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            <span className="badge mt-1.5 bg-tone-brand-soft text-tone-brand">{user.roleLabel}</span>
          </div>
          <Link href="/profile/edit" role="menuitem" onClick={close} className={item}>
            <UserRound aria-hidden className="inline size-4 align-[-0.125em]" /> {t.topbar.myProfile}
          </Link>
          <Link href="/profile" role="menuitem" onClick={close} className={item}>
            <TrendingUp aria-hidden className="inline size-4 align-[-0.125em]" /> {t.topbar.myProgress}
          </Link>
          {/* [Sprint 7.4]: historial de pagos en Angular (/pagos) → <a> con navegación completa */}
          <a href="/pagos" role="menuitem" onClick={close} className={item}>
            <CreditCard aria-hidden className="inline size-4 align-[-0.125em]" /> {t.topbar.myPayments}
          </a>
          <a href="/wallet" role="menuitem" onClick={close} className={item}>
            <Wallet aria-hidden className="inline size-4 align-[-0.125em]" /> {t.topbar.myWallet}
          </a>
          <a href="/certificados" role="menuitem" onClick={close} className={item}>
            <GraduationCap aria-hidden className="inline size-4 align-[-0.125em]" /> {t.topbar.myCertificates}
          </a>
          <div className="border-t border-border p-1">
            <LogoutButton />
          </div>
        </div>
      )}
    </Dropdown>
  );
}

// `export function`: barra completa | `sticky top-0`: queda visible al hacer scroll
// [Responsive]: móvil → fila 1: hamburguesa + iconos, fila 2: buscador a todo el ancho (`order-last basis-full`) · desde sm todo en una fila
export function PortalTopbar({ user }: { user: TopbarUser }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-2 flex flex-wrap items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <MobileNavButton />
      <TopbarSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <NotificationsMenu />
        <CartMenu />
        <ThemeMenu />
        <LanguageMenu />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
