import CheckCircleIcon from "@material-symbols/svg-400/rounded/check_circle.svg?react";
import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import InfoIcon from "@material-symbols/svg-400/rounded/info.svg?react";
import ProgressIcon from "@material-symbols/svg-400/rounded/progress_activity.svg?react";
import WarningIcon from "@material-symbols/svg-400/rounded/warning.svg?react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Snackbar (M3): inverse surface, bottom of the screen, short text with an optional action. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-center"
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <WarningIcon className="size-5" />,
        error: <ErrorIcon className="size-5" />,
        loading: <ProgressIcon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--md-sys-color-inverse-surface)",
          "--normal-text": "var(--md-sys-color-inverse-on-surface)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-xs)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "text-body-m min-h-12",
          actionButton: "text-label-l !text-inverse-primary !bg-transparent",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
