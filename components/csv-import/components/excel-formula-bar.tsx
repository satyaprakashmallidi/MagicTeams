'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';

interface ExcelFormulaBarProps {
  selectedCell: { row: number; col: number } | null;
  cellValue: string;
  onCellValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  headers: string[];
  isEditing: boolean;
}

export function ExcelFormulaBar({
  selectedCell,
  cellValue,
  onCellValueChange,
  onSave,
  onCancel,
  headers,
  isEditing
}: ExcelFormulaBarProps) {
  const [localValue, setLocalValue] = useState(cellValue);

  useEffect(() => {
    setLocalValue(cellValue);
  }, [cellValue]);

  const getCellReference = () => {
    if (!selectedCell) return '';
    const columnLetter = headers[selectedCell.col] || `Col${selectedCell.col + 1}`;
    const rowNumber = selectedCell.row + 1;
    return `${columnLetter}${rowNumber}`;
  };

  const handleSubmit = () => {
    onCellValueChange(localValue);
    onSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(cellValue);
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-background border-b">
      {/* Cell Reference */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-mono">
          {getCellReference() || 'A1'}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 w-6 p-0"
          >
            <Icon name="x" className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSubmit}
            className="h-6 w-6 p-0"
          >
            <Icon name="check" className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="flex-1">
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter value..."
          className="h-8 border-0 focus:ring-0 font-mono text-sm bg-background"
          disabled={!isEditing}
        />
      </div>

      {/* Status */}
      <div className="text-xs text-muted-foreground">
        {isEditing ? 'Edit' : 'Ready'}
      </div>
    </div>
  );
}