'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CSVFile } from '../types';

interface DeleteDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  activeFile?: CSVFile;
  onDelete: () => void;
  title?: string;
  message?: string;
}

export function DeleteDialog({
  showDialog,
  setShowDialog,
  activeFile,
  onDelete,
  title = "Delete Selected Rows",
  message,
}: DeleteDialogProps) {
  const defaultMessage = activeFile 
    ? `Are you sure you want to delete ${activeFile.selectedRows.length} selected rows? This action cannot be undone.`
    : "Are you sure you want to proceed with deletion? This action cannot be undone.";

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p>{message || defaultMessage}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}