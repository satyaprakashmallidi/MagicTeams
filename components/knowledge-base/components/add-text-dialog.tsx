'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AddTextDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (text: string) => void;
}

export function AddTextDialog({ isOpen, onClose, onAdd }: AddTextDialogProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(text);
    setText('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col bg-white">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl">Add Text Content</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 py-4">
          <Label htmlFor="text" className="text-lg mb-2">Text Content</Label>
          <div className="flex-1 min-h-0">
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text content here..."
              className="h-full resize-none font-mono border-2"
            />
          </div>
        </div>

        <div className="border-t pt-4 flex justify-end gap-2 bg-white">
          <Button type="button" variant="outline" onClick={() => {
            onClose();
            setText('');
          }}>
            Cancel
          </Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              if (text.trim()) {
                handleSubmit(e);
                onClose();
              }
            }} 
            disabled={!text.trim()}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
