import { index, layout, rootRoute, route } from "@tanstack/virtual-file-routes";

/**
 * URLs are Spanish (users see them); route files are English (Constitution VII and VIII).
 * Each feature adds its routes here.
 */
export const routes = rootRoute("root.tsx", [
  route("/ingresar", "sign-in.tsx"),
  route("/recuperar", "recover.tsx"),
  route("/restablecer", "reset-password.tsx"),
  route("/mensajero", "courier-home.tsx"),
  layout("panel", "panel-layout.tsx", [
    index("dispatch-board.tsx"),
    route("/envios/nuevo", "shipment-new.tsx"),
    route("/envios/masivo", "shipment-bulk.tsx"),
    route("/envios/$trackingNumber", "shipment-detail.tsx"),
    route("/envios/$trackingNumber/editar", "shipment-edit.tsx"),
    route("/historial", "history.tsx"),
    route("/clientes", "merchants.tsx"),
    route("/clientes/$merchantId", "merchant-detail.tsx"),
    route("/mensajeros", "couriers.tsx"),
    route("/transportadoras", "carriers.tsx"),
    route("/barrios", "neighborhoods.tsx"),
    route("/tarifario", "rate-card.tsx"),
    route("/auditoria", "audit-log.tsx"),
    route("/usuarios", "users.tsx"),
    route("/cuenta", "account.tsx"),
  ]),
]);
