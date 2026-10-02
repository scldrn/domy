/**
 * Generates the color roles of Domy (docs/design-system.md §3) and writes them to
 * apps/web/src/styles/tokens.css. Run with `pnpm tokens`; never edit the output.
 *
 * The scheme is M3 Tonal Spot with the seed's own slate as primary and nearly neutral
 * surfaces, so strong color is left to the states and to the one accent.
 */
import { writeFile } from "node:fs/promises";
import {
  argbFromHex,
  Blend,
  type DynamicColor,
  DynamicScheme,
  hexFromArgb,
  Hct,
  MaterialDynamicColors as C,
  SchemeTonalSpot,
  TonalPalette,
} from "@material/material-color-utilities";

/** Pizarra: the brand's slate (§3.1). */
const seed = argbFromHex("#34495E");
/** Verde azulado: the one accent, for focus and "now" on the board (§3.1). */
const accent = argbFromHex("#1F7A8C");

/** Custom colors (§3.3): the accent, kept as is, and the states, harmonized toward the seed. */
const customColors = {
  accent,
  success: argbFromHex("#2E7D32"),
  warning: argbFromHex("#F9A825"),
  info: argbFromHex("#1E6FD9"),
};

const roles: Record<string, DynamicColor> = {
  primary: C.primary,
  "on-primary": C.onPrimary,
  "primary-container": C.primaryContainer,
  "on-primary-container": C.onPrimaryContainer,
  secondary: C.secondary,
  "on-secondary": C.onSecondary,
  "secondary-container": C.secondaryContainer,
  "on-secondary-container": C.onSecondaryContainer,
  tertiary: C.tertiary,
  "on-tertiary": C.onTertiary,
  "tertiary-container": C.tertiaryContainer,
  "on-tertiary-container": C.onTertiaryContainer,
  error: C.error,
  "on-error": C.onError,
  "error-container": C.errorContainer,
  "on-error-container": C.onErrorContainer,
  surface: C.surface,
  "on-surface": C.onSurface,
  "on-surface-variant": C.onSurfaceVariant,
  "surface-container-lowest": C.surfaceContainerLowest,
  "surface-container-low": C.surfaceContainerLow,
  "surface-container": C.surfaceContainer,
  "surface-container-high": C.surfaceContainerHigh,
  "surface-container-highest": C.surfaceContainerHighest,
  "surface-dim": C.surfaceDim,
  "surface-bright": C.surfaceBright,
  "inverse-surface": C.inverseSurface,
  "inverse-on-surface": C.inverseOnSurface,
  "inverse-primary": C.inversePrimary,
  outline: C.outline,
  "outline-variant": C.outlineVariant,
  scrim: C.scrim,
  shadow: C.shadow,
};

type Mode = "light" | "dark" | "high-contrast";

function scheme(mode: Mode): DynamicScheme {
  const isDark = mode === "dark";
  const contrastLevel = mode === "high-contrast" ? 1 : 0;
  const tonalSpot = new SchemeTonalSpot(Hct.fromInt(seed), isDark, contrastLevel);
  const slate = Hct.fromInt(seed);
  return new DynamicScheme({
    sourceColorArgb: seed,
    variant: tonalSpot.variant,
    contrastLevel,
    isDark,
    primaryPalette: TonalPalette.fromHueAndChroma(slate.hue, slate.chroma),
    secondaryPalette: tonalSpot.secondaryPalette,
    tertiaryPalette: tonalSpot.tertiaryPalette,
    neutralPalette: TonalPalette.fromHueAndChroma(slate.hue, 4),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(slate.hue, 8),
  });
}

/**
 * Domy's own surfaces (§3.2): paper behind everything, sheets for content, and the dark
 * navigation rail. Tones come from the same palettes, so every scheme stays in harmony.
 */
const domyTones: Record<
  Mode,
  Record<string, ["neutral" | "variant" | "primary" | "accent", number]>
> = {
  light: {
    paper: ["neutral", 94],
    sheet: ["neutral", 100],
    "sheet-alt": ["neutral", 97],
    rail: ["primary", 20],
    "rail-raised": ["primary", 30],
    "on-rail": ["neutral", 98],
    "on-rail-variant": ["variant", 80],
    "rail-accent": ["accent", 80],
  },
  dark: {
    paper: ["neutral", 6],
    sheet: ["neutral", 12],
    "sheet-alt": ["neutral", 15],
    rail: ["primary", 8],
    "rail-raised": ["primary", 20],
    "on-rail": ["neutral", 92],
    "on-rail-variant": ["variant", 75],
    "rail-accent": ["accent", 80],
  },
  "high-contrast": {
    paper: ["neutral", 92],
    sheet: ["neutral", 100],
    "sheet-alt": ["neutral", 96],
    rail: ["primary", 10],
    "rail-raised": ["primary", 25],
    "on-rail": ["neutral", 100],
    "on-rail-variant": ["variant", 90],
    "rail-accent": ["accent", 90],
  },
};

function schemeVariables(mode: Mode): string[] {
  const colors = scheme(mode);
  const lines = Object.entries(roles).map(
    ([name, role]) => `  --md-sys-color-${name}: ${hexFromArgb(role.getArgb(colors))};`,
  );
  const palettes = {
    neutral: colors.neutralPalette,
    variant: colors.neutralVariantPalette,
    primary: colors.primaryPalette,
    accent: TonalPalette.fromInt(accent),
  };
  for (const [name, [palette, tone]] of Object.entries(domyTones[mode])) {
    lines.push(`  --md-sys-color-${name}: ${hexFromArgb(palettes[palette].tone(tone))};`);
  }
  for (const [name, value] of Object.entries(customColors)) {
    const source = value === accent ? accent : Blend.harmonize(value, seed);
    const custom = new SchemeTonalSpot(Hct.fromInt(source), colors.isDark, colors.contrastLevel);
    lines.push(
      `  --md-sys-color-${name}: ${hexFromArgb(C.primary.getArgb(custom))};`,
      `  --md-sys-color-on-${name}: ${hexFromArgb(C.onPrimary.getArgb(custom))};`,
      `  --md-sys-color-${name}-container: ${hexFromArgb(C.primaryContainer.getArgb(custom))};`,
      `  --md-sys-color-on-${name}-container: ${hexFromArgb(C.onPrimaryContainer.getArgb(custom))};`,
    );
  }
  return lines;
}

const light = schemeVariables("light");
const dark = schemeVariables("dark");
const highContrast = schemeVariables("high-contrast");

const css = `/* Generated by scripts/generate-design-tokens.ts from seed #34495E and accent #1F7A8C. Do not edit. */

:root {
  color-scheme: light;
${light.join("\n")}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-scheme]) {
    color-scheme: dark;
${dark.map((line) => `  ${line}`).join("\n")}
  }
}

[data-scheme="dark"] {
  color-scheme: dark;
${dark.join("\n")}
}

[data-scheme="high-contrast"] {
  color-scheme: light;
${highContrast.join("\n")}
}
`;

const output = new URL("../apps/web/src/styles/tokens.css", import.meta.url);
await writeFile(output, css);
console.log(`Wrote ${output.pathname}`);
