import { Badge } from "@/components/ui/badge";

/**
 * An event recorded by dispatch for a courier (design-system.md §8, 002 FR-025), the same in
 * every history.
 */
export function OnBehalfMark() {
  return <Badge variant="info">Registrado por despacho</Badge>;
}
