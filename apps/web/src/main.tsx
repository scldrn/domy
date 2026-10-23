import { z } from "zod";
import "./styles/globals.css";

// Apply this before app and domain modules evaluate schemas under the strict browser CSP.
z.config({ jitless: true });

void import("./app");
