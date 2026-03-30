export type AppShellPathHeaders = {
  pathname: string | null;
  rewrittenPath: string | null;
  nextUrl: string | null;
};

function normalizePathCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      return new URL(normalized).pathname || null;
    } catch {
      return null;
    }
  }

  if (!normalized.startsWith("/")) {
    return null;
  }

  const [pathname] = normalized.split(/[?#]/, 1);
  return pathname || null;
}

export function resolveAppShellCurrentPath(
  headers: AppShellPathHeaders,
  fallbackPath: string,
) {
  const candidates = [headers.pathname, headers.rewrittenPath, headers.nextUrl];

  for (const candidate of candidates) {
    const pathname = normalizePathCandidate(candidate);

    if (pathname) {
      return pathname;
    }
  }

  return fallbackPath;
}
