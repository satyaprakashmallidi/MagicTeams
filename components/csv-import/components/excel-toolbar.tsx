'use client';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { CSVFile } from '../types';

interface ExcelToolbarProps {
  file: CSVFile;
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteSelected: () => void;
  onStartCalls: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function ExcelToolbar({
  file,
  onAddRow,
  onAddColumn,
  onDeleteSelected,
  onStartCalls,
  onExportData,
  onImportData,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: ExcelToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted border-b">
      {/* File Operations */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onImportData}
          className="flex items-center gap-1 h-7 px-2 text-xs"
        >
          <Icon name="upload" className="h-3 w-3" />
          Import
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExportData}
          className="flex items-center gap-1 h-7 px-2 text-xs"
        >
          <Icon name="download" className="h-3 w-3" />
          Export
        </Button>
      </div>

      <Separator orientation="vertical" className="h-4" />

      {/* Insert Operations */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 h-7 px-2 text-xs"
            >
              <Icon name="plus" className="h-3 w-3" />
              Insert
              <Icon name="chevronDown" className="h-2 w-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onAddRow}>
              <Icon name="plus" className="h-3 w-3 mr-2" />
              Insert Row
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddColumn}>
              <Icon name="plus" className="h-3 w-3 mr-2" />
              Insert Column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Compact Stats */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-muted-foreground">
          {file.data.length} rows • {file.headers.length} columns
        </span>
        {file.selectedRows.length > 0 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
            {file.selectedRows.length} selected
          </Badge>
        )}
      </div>
    </div>
  );
}