import SymbolDrawing from "@/assets/brand/symbol.svg?react";
import WordmarkDrawing from "@/assets/brand/wordmark.svg?react";

/**
 * The brand's drawings (design-system.md §11), in the current text color. Size them by height;
 * the wordmark's y descends below its baseline, so a line under it can overlap its last fifth.
 */
export function Wordmark({ className }: { className?: string }) {
  return <WordmarkDrawing role="img" aria-hidden={false} aria-label="Domy" className={className} />;
}

export function LogoSymbol({ className }: { className?: string }) {
  return <SymbolDrawing role="img" aria-hidden={false} aria-label="Domy" className={className} />;
}
