import DarkModeIcon from "@material-symbols/svg-400/rounded/dark_mode.svg?react";
import LightModeIcon from "@material-symbols/svg-400/rounded/light_mode.svg?react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";

/** The panel's light/dark switch; its name says the theme it moves to (feature 006, FR-011). */
export function ThemeSwitch({ shown, onToggle }: { shown: Theme; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={shown === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="text-on-surface-variant hover:text-on-surface"
      onClick={onToggle}
    >
      <Icon symbol={shown === "dark" ? LightModeIcon : DarkModeIcon} />
    </Button>
  );
}
