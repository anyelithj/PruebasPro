/** @jest-environment node */
import { renderToString } from "react-dom/server";
import { PreferencesProvider } from "@/components/layout/PreferencesProvider";
import { MobileNavProvider, PortalFrame } from "@/components/portal/MobileNav";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalTopbar } from "@/components/portal/PortalTopbar";
import { WordDictionary } from "@/components/shared/WordDictionary";
import { NAV_BY_ROLE, navEntries } from "@aula/shared-nav/navigation";
// [Marco del portal en servidor · 2026-10-31]: «Element type is invalid … got: undefined» en /dashboard/admin solo aparece al renderizar en el servidor → aquí se renderiza igual que el layout | [Herramienta]: Jest + renderToString

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard/admin", useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const user = { name: "Admin", email: "a@b.co", roleLabel: "Administrador", initials: "AD", gradient: "red" };

it("el marco del portal se renderiza en el servidor con el buscador compartido", () => {
  const html = renderToString(
    <PreferencesProvider initialLocale="es">
      <MobileNavProvider initialCollapsed={false}>
        <PortalFrame>
          <PortalSidebar role="admin" displayName="Admin" />
          <PortalTopbar user={user} />
        </PortalFrame>
        <WordDictionary />
      </MobileNavProvider>
    </PreferencesProvider>,
  );
  expect(html).toContain('role="search"');
  expect(html).toContain("/admin/users");
});

it("menú restaurado: lista plana, sin desplegables por función", () => {
  expect(navEntries(NAV_BY_ROLE.admin).every((e) => !("items" in e))).toBe(true);
});
