"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type PublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  nextPublishedState: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
};

export function PublishDialog({
  open,
  onOpenChange,
  serviceName,
  nextPublishedState,
  isSubmitting = false,
  onConfirm,
}: PublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {nextPublishedState ? "Publish service" : "Unpublish service"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-300">
            {nextPublishedState
              ? `Make ${serviceName} visible to customers and open it for bookings.`
              : `Unpublish ${serviceName}. Customers will no longer be able to book it.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-white/15"
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            {nextPublishedState ? "Publish" : "Unpublish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

