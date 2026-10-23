const publicPagePrefixes = new Set(["seguimiento", "cliente"]);

export function isPublicPagePath(pathname: string): boolean {
  const firstSegment = pathname.split("/")[1];
  if (firstSegment === undefined) return false;

  try {
    return publicPagePrefixes.has(decodeURIComponent(firstSegment).toLowerCase());
  } catch {
    return false;
  }
}
