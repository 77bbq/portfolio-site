export type ResolvedConfiguredHref = {
  href: string;
  external: boolean;
};

export function normalizeBase(base: string | undefined): string {
  const normalized = base?.trim().replace(/^\/+|\/+$/g, "") ?? "";

  return normalized ? `/${normalized}` : "";
}

export function withBasePath(pathname: string, base?: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error(`Expected a site-root-relative path, received: ${pathname}`);
  }

  const normalizedBase = normalizeBase(base);
  if (!normalizedBase) {
    return pathname;
  }

  const alreadyPrefixed =
    pathname === normalizedBase ||
    pathname.startsWith(`${normalizedBase}/`) ||
    pathname.startsWith(`${normalizedBase}?`) ||
    pathname.startsWith(`${normalizedBase}#`);

  return alreadyPrefixed
    ? pathname
    : `${normalizedBase}${pathname === "/" ? "/" : pathname}`;
}

export function resolveConfiguredHref(
  href: string,
  base?: string,
): ResolvedConfiguredHref | null {
  const value = href.trim();
  if (!value) {
    return null;
  }

  if (/^https:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    }

    return { href: value, external: true };
  }

  if (/^mailto:/i.test(value)) {
    if (!value.slice(value.indexOf(":") + 1).trim()) {
      throw new Error("A mailto link must include an address");
    }

    return { href: value, external: false };
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return { href: withBasePath(value, base), external: false };
  }

  throw new Error(`Unsupported configured link: ${value}`);
}
