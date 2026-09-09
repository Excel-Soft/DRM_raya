import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// PLACEHOLDER: the real service-appointment-modal implementation was missing
// from this checkout (imported by service-executive-dashboard.tsx but absent
// from src/components). Replace with the real implementation once restored.
export function ServiceAppointmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Service Appointment</DialogTitle>
          <DialogDescription>
            This modal is a placeholder — the real service-appointment-modal implementation is missing from this checkout.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
