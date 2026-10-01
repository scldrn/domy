import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";

/**
 * A small form in a dialog for master data. `onOpen` prepares the values and a new
 * identifier each time it opens (FR-042); errors from the server stay in the dialog.
 */
export function FormDialog({
  triggerLabel,
  triggerVariant = "default",
  title,
  description,
  submitLabel,
  onOpen,
  onSubmit,
  children,
}: {
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  title: string;
  description?: ReactNode;
  submitLabel: string;
  onOpen?: () => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setErrors([]);
    try {
      await onSubmit();
      setOpen(false);
    } catch (error) {
      setErrors(
        error instanceof ApiError
          ? Object.keys(error.fields).length > 0
            ? Object.values(error.fields)
            : [error.message]
          : ["No pudimos guardar. Intenta de nuevo."],
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={triggerVariant}
        onClick={() => {
          onOpen?.();
          setErrors([]);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {children}
          {errors.length > 0 && (
            <ul role="alert" className="text-body-m text-error">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Volver</DialogClose>
            <Button type="submit" disabled={saving}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Luna, Luna Llena" as a list of aliases or variants. */
export const splitList = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
