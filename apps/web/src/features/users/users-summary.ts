import type { SentencePart } from "@/components/summary-sentence";
import { linkedCourier } from "./account-dialog";
import type { Account } from "./api";

/*
 * What «Usuarios» says about its accounts (feature 006, US5). Kept out of the route file:
 * route files hold only their route, or the router cannot split them from every page's code.
 */

export function initials(name: string): string {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}

type CourierLinks = Parameters<typeof linkedCourier>[0];

/** A courier account no courier is linked to needs the owner: it waits on its own page. */
const unlinked = (account: Account, couriers: CourierLinks) =>
  account.role === "courier" && !account.banned && linkedCourier(couriers, account.id) === null;

/** Accounts that need something first, then active ones, then by name. */
export function sortAccounts(accounts: Account[], couriers: CourierLinks): Account[] {
  return [...accounts].sort(
    (a, b) =>
      Number(unlinked(b, couriers)) - Number(unlinked(a, couriers)) ||
      Number(a.banned) - Number(b.banned) ||
      a.name.localeCompare(b.name, "es"),
  );
}

export function usersSentence(accounts: Account[], couriers: CourierLinks): SentencePart[] {
  const active = accounts.filter((account) => !account.banned);
  const count = (role: Account["role"]) => active.filter((account) => account.role === role).length;
  const roles = [
    [count("owner"), "propietario", "propietarios"],
    [count("dispatcher"), "coordinador", "coordinadores"],
    [count("courier"), "mensajero", "mensajeros"],
  ] as const;
  const listed = roles
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${String(n)} ${n === 1 ? one : many}`);
  const waiting = active.filter((account) => unlinked(account, couriers)).length;
  return [
    {
      text: `${String(active.length)} ${active.length === 1 ? "cuenta activa" : "cuentas activas"}`,
      strong: true,
    },
    {
      text: listed.length
        ? `: ${listed.slice(0, -1).join(", ")}${listed.length > 1 ? " y " : ""}${listed.at(-1) ?? ""}`
        : "",
    },
    ...(waiting > 0
      ? [
          { text: "; " },
          {
            text: `${String(waiting)} ${waiting === 1 ? "mensajero falta vincular" : "mensajeros faltan por vincular"}`,
            strong: true,
          },
          { text: "." },
        ]
      : [{ text: "." }]),
  ];
}
