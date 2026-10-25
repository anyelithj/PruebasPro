// [Helpers de accesibilidad]: aserciones sobre roles, nombres accesibles y foco sin depender de otra librería | [Patrón]: Test Helper | [Principio]: DRY + KISS | [A11y]: WCAG 2.1 AA (4.1.2 nombre, rol, valor)

// [accessibleName]: aria-label > aria-labelledby > <label for> > texto | suficiente para los controles de la app
export function accessibleName(el: Element): string {
  const label = el.getAttribute('aria-label');
  if (label) return label.trim();
  const by = el.getAttribute('aria-labelledby');
  if (by)
    return by
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ')
      .trim();
  const id = el.getAttribute('id');
  const forLabel = id ? el.ownerDocument.querySelector(`label[for="${id}"]`) : null;
  return (forLabel?.textContent ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// [Roles implícitos]: etiqueta HTML → rol ARIA (subset usado en la app)
const IMPLICIT: Record<string, string> = {
  button: 'button',
  link: 'a[href]',
  heading: 'h1,h2,h3,h4,h5,h6',
  textbox: 'input:not([type]),input[type=text],textarea',
  combobox: 'select',
  list: 'ul,ol',
  listitem: 'li',
};

// [getByRole]: primer elemento con ese rol (explícito o implícito) cuyo nombre contenga `name`
export function getByRole(root: ParentNode, role: string, name?: string | RegExp): HTMLElement {
  const nodes = [...root.querySelectorAll<HTMLElement>(`[role="${role}"]${IMPLICIT[role] ? ',' + IMPLICIT[role] : ''}`)];
  const match = nodes.find((n) => name === undefined || (typeof name === 'string' ? accessibleName(n).includes(name) : name.test(accessibleName(n))));
  if (!match) throw new Error(`Sin elemento role=${role} name=${String(name)}. Nombres: ${nodes.map(accessibleName).join(' | ')}`);
  return match;
}

// [expectAllNamed]: todos los botones y enlaces tienen nombre accesible (ningún icono mudo)
export function expectAllNamed(root: ParentNode): void {
  const mute = [...root.querySelectorAll('button, a[href]')].filter((el) => !accessibleName(el));
  expect(mute.map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
}
