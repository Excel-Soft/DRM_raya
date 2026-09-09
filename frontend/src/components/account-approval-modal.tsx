import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// PLACEHOLDER: the real account-approval-modal implementation was missing
// from this checkout (imported by account-manager-dashboard.tsx but absent
// from src/components). Replace with the real implementation once restored.
export function AccountApprovalModal({
  open,
  onOpenChange,
  gmEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gmEntry?: any;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account Approval</DialogTitle>
          <DialogDescription>
            This modal is a placeholder — the real account-approval-modal implementation is missing from this checkout.
            {gmEntry?.companyName ? ` (Entry: ${gmEntry.companyName})` : ""}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
