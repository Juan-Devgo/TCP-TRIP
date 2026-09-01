# Guía técnica — Sistema de navegación

**Fuente única:** `src/config/navigation.ts`
**Consumidores:** `src/components/common/AppSidebar.tsx`, `src/components/common/AppBreadcrumb.tsx`, `src/components/layouts/TabHost.tsx`, `src/components/layouts/TabBar.tsx`, `src/components/layouts/MainLayout.tsx`, `src/pages/HomePage.tsx`, `src/lib/tabs.ts`
**Relacionado:** `docs/ui/Tab.md` (historia de usuario del sistema de pestañas)

Este documento no es una historia de usuario: describe cómo está construida la navegación y cómo se agrega una página nueva.

---

## El problema que resuelve

Antes, la misma página se declaraba en cuatro sitios distintos, cada uno con su propia copia de la ruta escrita a mano:

| Sitio | Qué declaraba |
| --- | --- |
| `AppSidebar.tsx` | tres tablas (`TOOL_SECTIONS`, `THEORY_SECTIONS`, `PROTOCOL_LINKS`) con ruta + `labelKey` + ícono |
| `AppBreadcrumb.tsx` | `SEGMENT_LABEL_KEYS`: segmento de ruta → clave i18n |
| `config/pages.ts` | el registro de pestañas: ruta + `titleKey` + `wide` |
| `TabHost.tsx` | ruta → componente de la página |

Nada obligaba a que las cuatro coincidieran, y no coincidían, por ejemplo: el sidebar enlazaba `/generic-protocol/new`, el registro listaba `/protocol/mine` y `/messages`, y `TabHost` mapeaba `/protocol/new`. Resultado: **el constructor de protocolos nunca se montaba** — su pestaña abría el `PlaceholderPage` — y nadie lo notaba porque cada archivo era coherente consigo mismo.

La solución elimina la posibilidad del error en vez de corregir las copias: **un único árbol, y las rutas no se escriben.**

---

## El árbol

`src/config/navigation.ts` exporta `NAVIGATION`, un árbol de nodos. Cada nodo declara un **segmento**, no una ruta:

```ts
{
  segment: "calculators",
  titleKey: "sidebar.tools.calculators",
  icon: Calculator,
  children: [
    { segment: "ipv4", titleKey: "sidebar.calculators.ipv4", page: true },
  ],
}
```

| Campo | Significado |
| --- | --- |
| `segment` | Un segmento de ruta. La ruta absoluta es la unión de los segmentos de sus ancestros — aquí, `/tools/calculators/ipv4`. |
| `titleKey` | Clave i18n. **La misma clave** etiqueta el ítem del sidebar, el título de la pestaña y la miga del breadcrumb: no pueden divergir. |
| `icon` | Ícono de `lucide-react` para el sidebar. Los grupos de nivel 0 no llevan. |
| `page` | Si está presente, el nodo abre como pestaña. `true` para una página normal; `{ wide: true }` para una página tipo lienzo que renuncia a la columna de ancho de lectura (por ejemplo, el diagrama del protocolo). |
| `children` | Si está presente, el nodo es una rama. Un arreglo vacío es una sección todavía sin páginas: renderiza el aviso "sin ítems". Si está ausente, el nodo es un enlace hoja. |

El archivo es **solo metadatos**: no importa JSX ni componentes de features, de modo que la capa pura de pestañas (`src/lib/tabs.ts`, con sus tests sin React) puede importarlo.

---

## Qué se deriva del árbol

Todo lo demás es una proyección de `NAVIGATION`, calculada una vez al cargar el módulo:

| Export | Quién lo usa | Para qué |
| --- | --- | --- |
| `NAV_TREE: NavItem[]` | `AppSidebar` | El mismo árbol con rutas absolutas ya resueltas. |
| `findNavItem(path)` | `AppBreadcrumb` | Etiqueta de cualquier nodo, sea página o agrupador. Reemplazó a `SEGMENT_LABEL_KEYS`. |
| `PAGES: PageDefinition[]` | `HomePage` | Las páginas que abren pestaña, en orden de sidebar. |
| `findPage(path)` | `TabBar`, `TabHost`, `MainLayout` | Título de la pestaña, fallback al placeholder, bandera `wide`. |
| `isPagePath(path)` | `src/lib/tabs.ts` | Decide si un pathname abre pestaña o es navegación *dentro* de la pestaña activa. |
| `PagePath` | `TabHost` | Unión de literales con todas las rutas de página (ver más abajo). |
| `HOME_PATH` | `NotFoundPage` | El inicio es el estado vacío, no una pestaña: no está en el árbol. |

---

## Cómo renderiza el sidebar

`AppSidebar` no conoce ninguna ruta ni ningún ícono: recorre `NAV_TREE` y decide por la **forma** del nodo, sin banderas extra.

| Nivel | Forma | Se renderiza como |
| --- | --- | --- |
| 0 | siempre | `SidebarGroup` con su etiqueta en mayúsculas |
| 1 | con `children` | `Collapsible` (`NavSection`) — si está vacío, muestra `sidebar.empty` |
| 1 | sin `children` | Enlace directo con ícono (los tres ítems de Protocolo Genérico) |
| 2 | — | `SidebarMenuSubButton` dentro del colapsable |

El breadcrumb sigue la misma fuente: parte el pathname en prefijos, busca cada uno con `findNavItem` y usa su `titleKey`. Un nodo sin `page` (por ejemplo `/tools`) sale como miga **no navegable**; un segmento desconocido cae al texto crudo.

---

## Agregar una página

Tres pasos. Ninguno implica escribir una ruta dos veces.

**1. Un nodo en `NAVIGATION`** (`src/config/navigation.ts`), donde corresponda en el árbol:

```ts
{ segment: "ipv6", titleKey: "sidebar.calculators.ipv6", page: true },
```

**2. Su componente en `PAGE_COMPONENTS`** (`src/components/layouts/TabHost.tsx`), importado por el barrel de la feature:

```ts
"/tools/calculators/ipv6": IPv6Calculator,
```

**3. El `titleKey` en los dos archivos de locale** (`src/config/locales/{en,es}/translation.json`).

Con eso quedan resueltos, sin tocar nada más: el enlace del sidebar, el título de la pestaña, la etiqueta del breadcrumb, la tarjeta en la pantalla de inicio, y el comportamiento de apertura de pestaña.

Una página listada en el árbol **sin** entrada en `PAGE_COMPONENTS` renderiza el `PlaceholderPage`, así el sidebar nunca abre una pestaña en blanco.

---

## Seguridad de tipos

`PagePath` es una unión de literales derivada del árbol con tipos condicionales recursivos, y `PAGE_COMPONENTS` está tipado como `Partial<Record<PagePath, ComponentType>>`. Una ruta mal escrita u obsoleta **no compila**:

```
src/components/layouts/TabHost.tsx: error TS2322: Type '"/protocol/new"' is not assignable to type
  '"/generic-protocol/messages" | "/generic-protocol/mine" | "/generic-protocol/new"
   | "/tools/calculators/ipv4" | "/tools/converters/ascii" | "/tools/converters/number-bases"'.
```

Es decir: el bug que motivó este rediseño ahora es un error de `bun run typecheck`, no una pestaña que en silencio muestra el placeholder.

---

## Invariantes

- **No escribir rutas a mano en ningún componente.** Si se necesita una ruta, viene del árbol (`NAV_TREE`, `PAGES`, `findPage`). Las excepciones vivas son `HOME_PATH` y los tests.
- **Una clave i18n por nodo.** No agregar una clave aparte para la pestaña o el breadcrumb: comparten `titleKey` a propósito.
- **`navigation.ts` no importa features ni JSX.** Si algo necesita un componente de página, va en `TabHost`, no en el árbol — de lo contrario la capa pura de pestañas arrastraría todas las herramientas.
- **Los tests de `src/lib/tabs.ts` usan rutas reales del registro.** `isPagePath` consulta el árbol, así que una ruta inventada en un test se comporta como navegación intra-pestaña y el test falla por la razón equivocada.
