import { z } from "zod";
import "./styles/globals.css";

// Apply this before app and domain modules evaluate schemas under the strict browser CSP.
z.config({ jitless: true });

void import("./app");
// The courier app's guard needs the phone's store before anything shows; fetch it alongside the
// app instead of after it, since it is no longer part of the app bundle (routes/courier-layout).
if (window.location.pathname.startsWith("/mensajero"))
  void import("./features/courier/courier-store").catch(() => undefined);
