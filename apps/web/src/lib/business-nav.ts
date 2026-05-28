const PANEL_SEGMENTS =
  "conversations|appointments|catalog|payments|faqs|whatsapp|settings";

const PANEL_PATH = new RegExp(
  `^/businesses/[^/]+/(${PANEL_SEGMENTS})/?$`
);

export function isBusinessPanelHref(href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  return PANEL_PATH.test(path.replace(/\/$/, "") || path);
}

export function isActivePanelRoute(pathname: string, href: string): boolean {
  const p = (pathname.split("?")[0] ?? pathname).replace(/\/$/, "") || "/";
  const h = (href.split("?")[0] ?? href).replace(/\/$/, "") || "/";
  return p === h || p.startsWith(`${h}/`);
}
