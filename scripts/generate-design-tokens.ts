/**
 * Generates the color roles of Domy (docs/design-system.md §3) and writes them to
 * apps/web/src/styles/tokens.css. Run with `pnpm tokens`; never edit the output.
 *
 * The scheme is M3 Tonal Spot with the seed's own slate as primary and nearly neutral
 * surfaces, so strong color is left to the states and to the one accent. The pizarra surfaces
 * and the lime accent follow the revision approved for feature 006 (FR-001, research R1, R2).
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
/** Lima: the one accent, a fill and a mark, never text on a light surface (§3.1). */
const accent = argbFromHex("#C8F23C");
/** Pizarra: the seed's hue at the chroma of the approved board's dark blocks (§3.1). */
const pizarraChroma = 14;

/** State custom colors (§3.3), harmonized toward the seed. */
const customColors = {
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
 * Domy's own roles (§3.2): paper behind everything, sheets for content, the pizarra surfaces,
 * and the lime accent with its text and its strong tone for focus on light surfaces. Tones come
 * from the same palettes, so every scheme stays in harmony.
 */
const domyTones: Record<Mode, Record<string, ["neutral" | "pizarra" | "accent", number]>> = {
  light: {
    paper: ["neutral", 94],
    sheet: ["neutral", 100],
    "sheet-alt": ["neutral", 97],
    rail: ["pizarra", 11],
    "rail-raised": ["pizarra", 20],
    "rail-line": ["pizarra", 25],
    "on-rail": ["neutral", 98],
    "on-rail-variant": ["pizarra", 80],
    accent: ["accent", 90],
    "on-accent": ["accent", 10],
    "accent-strong": ["accent", 50],
  },
  dark: {
    paper: ["neutral", 6],
    sheet: ["neutral", 12],
    "sheet-alt": ["neutral", 15],
    rail: ["pizarra", 11],
    "rail-raised": ["pizarra", 20],
    "rail-line": ["pizarra", 25],
    "on-rail": ["neutral", 92],
    "on-rail-variant": ["pizarra", 80],
    accent: ["accent", 90],
    "on-accent": ["accent", 10],
    "accent-strong": ["accent", 80],
  },
  "high-contrast": {
    paper: ["neutral", 92],
    sheet: ["neutral", 100],
    "sheet-alt": ["neutral", 96],
    rail: ["pizarra", 8],
    "rail-raised": ["pizarra", 25],
    "rail-line": ["pizarra", 30],
    "on-rail": ["neutral", 100],
    "on-rail-variant": ["pizarra", 90],
    accent: ["accent", 90],
    "on-accent": ["accent", 10],
    "accent-strong": ["accent", 40],
  },
};

function schemeVariables(mode: Mode): string[] {
  const colors = scheme(mode);
  const lines = Object.entries(roles).map(
    ([name, role]) => `  --md-sys-color-${name}: ${hexFromArgb(role.getArgb(colors))};`,
  );
  const palettes = {
    neutral: colors.neutralPalette,
    pizarra: TonalPalette.fromHueAndChroma(Hct.fromInt(seed).hue, pizarraChroma),
    accent: TonalPalette.fromInt(accent),
  };
  for (const [name, [palette, tone]] of Object.entries(domyTones[mode])) {
    lines.push(`  --md-sys-color-${name}: ${hexFromArgb(palettes[palette].tone(tone))};`);
  }
  for (const [name, value] of Object.entries(customColors)) {
    const source = Hct.fromInt(Blend.harmonize(value, seed));
    const custom = new SchemeTonalSpot(source, colors.isDark, colors.contrastLevel);
    lines.push(
      `  --md-sys-color-${name}: ${hexFromArgb(C.primary.getArgb(custom))};`,
      `  --md-sys-color-on-${name}: ${hexFromArgb(C.onPrimary.getArgb(custom))};`,
      `  --md-sys-color-${name}-container: ${hexFromArgb(C.primaryContainer.getArgb(custom))};`,
      `  --md-sys-color-on-${name}-container: ${hexFromArgb(C.onPrimaryContainer.getArgb(custom))};`,
      // On pizarra every scheme uses the state's dark-scheme tone (§3.2).
      `  --md-sys-color-rail-${name}: ${hexFromArgb(new SchemeTonalSpot(source, true, 0).primaryPalette.tone(80))};`,
    );
  }
  lines.push(
    `  --md-sys-color-rail-error: ${hexFromArgb(colors.errorPalette.tone(80))};`,
    `  --md-sys-color-rail-tertiary: ${hexFromArgb(colors.tertiaryPalette.tone(80))};`,
  );
  return lines;
}

const light = schemeVariables("light");
const dark = schemeVariables("dark");
const highContrast = schemeVariables("high-contrast");

const css = `/* Generated by scripts/generate-design-tokens.ts from seed #34495E and accent #C8F23C. Do not edit. */

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
