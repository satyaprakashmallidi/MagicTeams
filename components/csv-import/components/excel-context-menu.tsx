'use client';

import { useState } from 'react';
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuSeparator, 
  ContextMenuTrigger 
} from '@/components/ui/context-menu';
import { Icon } from '@/components/ui/icons';

interface ExcelContextMenuProps {
  children: React.ReactNode;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  onDelete: () => void;
  onInsertRow: () => void;
  onInsertColumn: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;
  canPaste: boolean;
  selectedCell: { row: number; col: number } | null;
}

export function ExcelContextMenu({
  children,
  onCopy,
  onPaste,
  onCut,
  onDelete,
  onInsertRow,
  onInsertColumn,
  onDeleteRow,
  onDeleteColumn,
  canPaste,
  selectedCell
}: ExcelContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onCopy}>
          <Icon name="copy" className="mr-2 h-4 w-4" />
          Copy
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onPaste} disabled={!canPaste}>
          <Icon name="paste" className="mr-2 h-4 w-4" />
          Paste
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+V</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCut}>
          <Icon name="cut" className="mr-2 h-4 w-4" />
          Cut
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+X</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete}>
          <Icon name="trash" className="mr-2 h-4 w-4" />
          Delete
          <span className="ml-auto text-xs text-muted-foreground">Del</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onInsertRow}>
          <Icon name="plus" className="mr-2 h-4 w-4" />
          Insert Row Above
        </ContextMenuItem>
        <ContextMenuItem onClick={onInsertColumn}>
          <Icon name="plus" className="mr-2 h-4 w-4" />
          Insert Column Left
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDeleteRow}>
          <Icon name="minus" className="mr-2 h-4 w-4" />
          Delete Row
        </ContextMenuItem>
        <ContextMenuItem onClick={onDeleteColumn}>
          <Icon name="minus" className="mr-2 h-4 w-4" />
          Delete Column
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}