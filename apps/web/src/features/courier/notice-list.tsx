import { noticeText } from "@domy/domain";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgeCourierNotices, useCourierState } from "./courier-store";

/** FR-027: acknowledge exactly the notices shown, never future changes. */
export function NoticeList() {
  const heading = useId();
  const { view, userId } = useCourierState();
  const [saving, setSaving] = useState(false);
  const notices = view?.notices ?? [];
  if (!userId || notices.length === 0) return null;
  const acknowledge = async () => {
    setSaving(true);
    try {
      await acknowledgeCourierNotices(
        userId,
        notices.map((notice) => notice.id),
      );
    } catch {
      toast.error("No pudimos guardar la confirmación. Intenta de nuevo; los avisos siguen aquí.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      aria-labelledby={heading}
      className="flex flex-col gap-3 rounded-md border border-outline bg-secondary-container p-4 text-on-secondary-container"
    >
      <h2 id={heading} className="text-title-m">
        Cambios de tu ruta
      </h2>
      <ul className="flex flex-col gap-2 text-body-l">
        {notices.map((notice) => (
          <li key={notice.id}>
            {noticeText(notice.type, {
              ...(notice.routeNumber !== null && { routeNumber: notice.routeNumber }),
              ...(notice.trackingNumber && { trackingNumber: notice.trackingNumber }),
            })}
          </li>
        ))}
      </ul>
      <Button className="self-end" disabled={saving} onClick={() => void acknowledge()}>
        Entendido
      </Button>
    </section>
  );
}

export function HandoversToGive() {
  const heading = useId();
  const { view } = useCourierState();
  const handovers = view?.handoversToGive ?? [];
  if (handovers.length === 0) return null;
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-2">
      <h2 id={heading} className="text-title-m text-on-surface">
        Paquetes por entregar a otro mensajero
      </h2>
      <ul className="flex flex-col gap-2">
        {handovers.map((handover) => (
          <li
            key={handover.handoverId}
            className="rounded-md border border-outline-variant bg-sheet p-4 text-body-l wrap-anywhere text-on-surface"
          >
            Entregar a {handover.toCourier.name}
            <span className="block text-body-m text-on-surface-variant">
              Guía {handover.trackingNumber} · Conservas la custodia hasta que confirme que lo
              recibió.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
