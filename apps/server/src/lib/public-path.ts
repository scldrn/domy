const publicLogRoutes = new Set(["tracking", "merchant", "test-error"]);

function decodedSegments(path: string): string[] {
  return path.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
}

export function isPublicApiPath(path: string): boolean {
  const segments = decodedSegments(path);
  return segments[1]?.toLowerCase() === "api" && segments[2]?.toLowerCase() === "public";
}

export function isPublicDocumentPath(path: string): boolean {
  const root = decodedSegments(path)[1]?.toLowerCase();
  return root === "seguimiento" || root === "cliente";
}

export function isPublicResponsePath(path: string): boolean {
  return isPublicApiPath(path) || isPublicDocumentPath(path);
}

/** Replaces public bearer segments with route parameters while retaining route diagnostics. */
export function publicPathForLog(path: string, routeTemplate = ":unmatched"): string {
  const segments = decodedSegments(path);
  if (segments[1]?.toLowerCase() === "api" && segments[2]?.toLowerCase() === "public") {
    const endpoint = segments[3]?.toLowerCase();
    if (!endpoint) return "/api/public";
    if (!publicLogRoutes.has(endpoint)) return "/api/public/:route";

    if (endpoint === "merchant") {
      const suffix = segments.slice(4).map((segment) => segment.toLowerCase());
      if (suffix[1] === "photos") return "/api/public/merchant/:code/photos/:photoId";
      if (suffix[1] === "shipments") return "/api/public/merchant/:code/shipments/:id";
      return suffix.length ? "/api/public/merchant/:code" : "/api/public/merchant";
    }

    return segments.length > 4 ? `/api/public/${endpoint}/:code` : `/api/public/${endpoint}`;
  }

  const publicDocument = segments[1]?.toLowerCase();
  if (publicDocument === "seguimiento" || publicDocument === "cliente") {
    return segments.length > 2 ? `/${publicDocument}/:code` : `/${publicDocument}`;
  }

  if (/^\/api\/auth\/reset-password\//iu.test(segments.join("/"))) {
    return "/api/auth/reset-password/:token";
  }

  // Better Auth owns this catch-all; keep this fixed recovery diagnostic.
  if (segments.join("/").toLowerCase() === "/api/auth/request-password-reset") {
    return "/api/auth/request-password-reset";
  }

  return routeTemplate || ":unmatched";
}
