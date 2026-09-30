import { index, layout, rootRoute, route } from "@tanstack/virtual-file-routes";

/**
 * URLs are Spanish (users see them); route files are English (Constitution VII and VIII).
 * Each feature adds its routes here.
 */
export const routes = rootRoute("root.tsx", [
  route("/ingresar", "sign-in.tsx"),
  layout("panel", "panel-layout.tsx", [
    index("dispatch-board.tsx"),
    route("/envios/nuevo", "shipment-new.tsx"),
    route("/envios/$trackingNumber", "shipment-detail.tsx"),
    route("/envios/$trackingNumber/editar", "shipment-edit.tsx"),
  ]),
]);
