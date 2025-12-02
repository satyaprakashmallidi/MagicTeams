'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronFirstIcon, ChevronLastIcon, ChevronRightIcon, ChevronLeftIcon } from 'lucide-react';
import { CSVFile } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ExcelToolbar } from './excel-toolbar';
import { ExcelContextMenu } from './excel-context-menu';
import { ExcelFormulaBar } from './excel-formula-bar';

interface ExcelTableProps {
  file: CSVFile;
  searchTerm: string;
  editingCell: { rowIndex: number | null; header: string; value: string } | null;
  onCellEdit: (rowIndex: number | null, header: string, value: string) => void;
  onCellSave: () => void;
  onRowSelect: (rowIndex: number) => void;
  onPageChange: (fileId: string, newPage: number) => void;
  onRowsPerPageChange: (fileId: string, newRowsPerPage: number) => void;
  setEditingCell: (value: { rowIndex: number | null; header: string; value: string } | null) => void;
  onDeleteColumn: (header: string) => void;
  onAddRow: () => void;
  onStartCalls: () => void;
  onDeleteSelected: () => void;
  onAddColumn: (columnName: string) => void;
  onLoadMoreRows?: (fileId: string, offset: number) => Promise<void>;
  isLoadingMore?: boolean;
  isChangingPageSize?: boolean;
}

interface CellSelection {
  row: number;
  col: number;
}

export function ExcelTable({
  file,
  searchTerm,
  editingCell,
  onCellEdit,
  onCellSave,
  onRowSelect,
  onPageChange,
  onRowsPerPageChange,
  setEditingCell,
  onDeleteColumn,
  onAddRow,
  onStartCalls,
  onDeleteSelected,
  onAddColumn,
  onLoadMoreRows,
  isLoadingMore = false,
  isChangingPageSize = false
}: ExcelTableProps) {
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [copiedCell, setCopiedCell] = useState<{ row: number; col: number; value: string } | null>(null);
  const [cutCell, setCutCell] = useState<{ row: number; col: number; value: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [loadedChunks, setLoadedChunks] = useState<Set<number>>(new Set([0]));
  const [isVirtualScrolling, setIsVirtualScrolling] = useState(false);

  // Check if we're in virtual scrolling mode (only for 10000 rows)
  useEffect(() => {
    setIsVirtualScrolling(file.rowsPerPage === 10000);
    if (file.rowsPerPage === 10000) {
      setLoadedChunks(new Set([0])); // Reset to first chunk when switching to virtual mode
    }
  }, [file.rowsPerPage]);

  const { pageData, totalRows, totalPages } = useMemo(() => {
    // When searching, filter the current page data
    const filteredData = searchTerm 
      ? file.data.filter(row =>
          Object.values(row).some(value =>
            value?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        )
      : file.data;

    // For virtual scrolling mode, we show all loaded data
    if (isVirtualScrolling) {
      // Virtual scrolling still uses pages, but loads 10000 rows per page (in chunks)
      const virtualPageSize = 10000;
      const totalVirtualPages = Math.ceil((file.totalRows || filteredData.length) / virtualPageSize);
      
      return {
        pageData: filteredData,
        totalRows: file.totalRows || filteredData.length,
        totalPages: totalVirtualPages
      };
    }

    // Normal pagination mode
    // When we have totalRows from database, we're doing server-side pagination
    // The data is already paginated, so we don't need to slice it again
    const isServerPaginated = file.totalRows !== undefined && file.totalRows > 0;
    
    if (isServerPaginated) {
      // Data is already paginated from the server
      return {
        pageData: filteredData,
        totalRows: searchTerm ? filteredData.length : file.totalRows,
        totalPages: searchTerm 
          ? Math.ceil(filteredData.length / file.rowsPerPage)
          : Math.ceil(file.totalRows / file.rowsPerPage)
      };
    } else {
      // Client-side pagination for locally loaded files
      const startIndex = (file.currentPage - 1) * file.rowsPerPage;
      const endIndex = startIndex + file.rowsPerPage;
      
      return {
        pageData: filteredData.slice(startIndex, endIndex),
        totalRows: filteredData.length,
        totalPages: Math.ceil(filteredData.length / file.rowsPerPage)
      };
    }
  }, [file.data, file.currentPage, file.rowsPerPage, searchTerm, file.totalRows, isVirtualScrolling]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">✓ Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800 text-xs">⏳ In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">✗ Failed</Badge>;
      case 'not_called':
        return <Badge variant="secondary" className="text-xs">◯ Not Called</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getInterestBadge = (interest: string) => {
    switch (interest) {
      case 'interested':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">👍 Interested</Badge>;
      case 'not_interested':
        return <Badge variant="default" className="bg-red-100 text-red-800 border-red-200 text-xs">👎 Not Interested</Badge>;
      case 'not_specified':
        return <Badge variant="secondary" className="text-xs">❓ Not Specified</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{interest}</Badge>;
    }
  };

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setIsEditing(false);
  }, []);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setIsEditing(true);
    const header = file.headers[col];
    const value = row === -1 ? header : pageData[row][header] || '';
    onCellEdit(row === -1 ? null : ((file.currentPage - 1) * file.rowsPerPage) + row, header, value);
  }, [file.headers, pageData, file.currentPage, file.rowsPerPage, onCellEdit]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedCell) return;

    // If we're editing a cell, don't handle navigation keys
    if (isEditing) return;

    const { row, col } = selectedCell;
    const maxRow = pageData.length - 1;
    const maxCol = file.headers.length - 1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > -1) {
          setSelectedCell({ row: Math.max(-1, row - 1), col });
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (row < maxRow) {
          setSelectedCell({ row: Math.min(maxRow, row + 1), col });
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          setSelectedCell({ row, col: col - 1 });
        }
        break;
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (col < maxCol) {
          setSelectedCell({ row, col: col + 1 });
        }
        break;
      case 'Enter':
        e.preventDefault();
        setIsEditing(true);
        const header = file.headers[col];
        const value = row === -1 ? header : pageData[row][header] || '';
        onCellEdit(row === -1 ? null : ((file.currentPage - 1) * file.rowsPerPage) + row, header, value);
        break;
      case 'Escape':
        e.preventDefault();
        setIsEditing(false);
        setEditingCell(null);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (row >= 0) {
          const header = file.headers[col];
          onCellEdit(((file.currentPage - 1) * file.rowsPerPage) + row, header, '');
          onCellSave();
        }
        break;
      case 'c':
      case 'C':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const header = file.headers[col];
          const value = row === -1 ? header : pageData[row][header] || '';
          setCopiedCell({ row, col, value });
          navigator.clipboard?.writeText(value);
        }
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          navigator.clipboard?.readText().then(text => {
            if (row >= 0) {
              const header = file.headers[col];
              onCellEdit(((file.currentPage - 1) * file.rowsPerPage) + row, header, text);
              onCellSave();
            }
          });
        }
        break;
    }
  }, [selectedCell, pageData, file.headers, file.currentPage, file.rowsPerPage, isEditing, onCellEdit, onCellSave, setEditingCell]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  // Handle scroll for lazy loading
  useEffect(() => {
    if (!isVirtualScrolling || !onLoadMoreRows || !tableRef.current) return;

    const handleScroll = async () => {
      const element = tableRef.current;
      if (!element) return;

      // Check if user has scrolled near the bottom
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      
      // Load more when within 200px of bottom
      if (scrollHeight - scrollTop - clientHeight < 200 && !isLoadingMore) {
        const currentLoadedRows = file.data.length;
        const nextChunkIndex = Math.floor(currentLoadedRows / 1000);
        
        // Check if we haven't loaded this chunk yet and we haven't loaded all rows
        if (!loadedChunks.has(nextChunkIndex) && currentLoadedRows < (file.totalRows || 0)) {
          setLoadedChunks(prev => new Set([...prev, nextChunkIndex]));
          await onLoadMoreRows(file.id, currentLoadedRows);
        }
      }
    };

    const element = tableRef.current;
    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [isVirtualScrolling, onLoadMoreRows, file.id, file.data.length, file.totalRows, isLoadingMore, loadedChunks]);

  const getColumnWidth = (header: string) => {
    return columnWidths[header] || 150;
  };

  const handleColumnResize = (header: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [header]: width }));
  };

  const getCellValue = (row: number, header: string) => {
    const value = pageData[row][header] || '';
    
    if (header === 'call_status' && value) {
      return getStatusBadge(value);
    }
    
    if (header === 'interest' && value) {
      return getInterestBadge(value);
    }
    
    return value;
  };

  const isCellSelected = (row: number, col: number) => {
    return selectedCell?.row === row && selectedCell?.col === col;
  };

  const isCellEditing = (row: number, col: number) => {
    return isEditing && selectedCell?.row === row && selectedCell?.col === col;
  };

  const handleAddColumn = () => {
    try {
      const newColumnName = `New_Column_${file.headers.length + 1}`;
      onAddColumn(newColumnName);
    } catch (error) {
      console.error('Error adding column:', error);
    }
  };

  const handleExportData = () => {
    const headers = file.headers.filter(h => h !== 'dbId');
    const csvRows = [
      headers.join(','),
      ...file.data.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${file.name.replace(/\.[^/.]+$/, '')}_exported.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleImportData = () => {
    document.getElementById('csvInput')?.click();
  };

  const handleUndo = () => {
    // TODO: Implement undo functionality
    console.log('Undo');
  };

  const handleRedo = () => {
    // TODO: Implement redo functionality
    console.log('Redo');
  };

  const handleContextCopy = () => {
    if (!selectedCell) return;
    const header = file.headers[selectedCell.col];
    const value = selectedCell.row === -1 ? header : pageData[selectedCell.row][header] || '';
    setCopiedCell({ row: selectedCell.row, col: selectedCell.col, value });
    navigator.clipboard?.writeText(value);
  };

  const handleContextPaste = () => {
    if (!selectedCell) return;
    navigator.clipboard?.readText().then(text => {
      if (selectedCell.row >= 0) {
        const header = file.headers[selectedCell.col];
        onCellEdit(((file.currentPage - 1) * file.rowsPerPage) + selectedCell.row, header, text);
        onCellSave();
      }
    });
  };

  const handleContextCut = () => {
    if (!selectedCell) return;
    const header = file.headers[selectedCell.col];
    const value = selectedCell.row === -1 ? header : pageData[selectedCell.row][header] || '';
    setCutCell({ row: selectedCell.row, col: selectedCell.col, value });
    setCopiedCell({ row: selectedCell.row, col: selectedCell.col, value });
    navigator.clipboard?.writeText(value);
    
    if (selectedCell.row >= 0) {
      onCellEdit(((file.currentPage - 1) * file.rowsPerPage) + selectedCell.row, header, '');
      onCellSave();
    }
  };

  const handleContextDelete = () => {
    if (!selectedCell || selectedCell.row < 0) return;
    const header = file.headers[selectedCell.col];
    onCellEdit(((file.currentPage - 1) * file.rowsPerPage) + selectedCell.row, header, '');
    onCellSave();
  };

  const getCurrentCellValue = () => {
    if (!selectedCell) return '';
    const header = file.headers[selectedCell.col];
    return selectedCell.row === -1 ? header : pageData[selectedCell.row][header] || '';
  };

  const handleFormulaBarChange = (value: string) => {
    if (!selectedCell) return;
    const header = file.headers[selectedCell.col];
    const actualRowIndex = selectedCell.row === -1 ? null : ((file.currentPage - 1) * file.rowsPerPage) + selectedCell.row;
    onCellEdit(actualRowIndex, header, value);
  };

  const handleFormulaBarSave = () => {
    onCellSave();
    setIsEditing(false);
  };

  const handleFormulaBarCancel = () => {
    setEditingCell(null);
    setIsEditing(false);
  };

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col min-h-0 bg-background">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <ExcelToolbar
            file={file}
            onAddRow={onAddRow}
            onAddColumn={handleAddColumn}
            onDeleteSelected={onDeleteSelected}
            onStartCalls={onStartCalls}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={false}
            canRedo={false}
          />
          <ExcelFormulaBar
            selectedCell={selectedCell}
            cellValue={getCurrentCellValue()}
            onCellValueChange={handleFormulaBarChange}
            onSave={handleFormulaBarSave}
            onCancel={handleFormulaBarCancel}
            headers={file.headers}
            isEditing={isEditing}
          />
          <ExcelContextMenu
            onCopy={handleContextCopy}
            onPaste={handleContextPaste}
            onCut={handleContextCut}
            onDelete={handleContextDelete}
            onInsertRow={onAddRow}
            onInsertColumn={handleAddColumn}
            onDeleteRow={() => onDeleteSelected()}
            onDeleteColumn={() => {
              if (selectedCell) {
                const header = file.headers[selectedCell.col];
                onDeleteColumn(header);
              }
            }}
            canPaste={!!copiedCell}
            selectedCell={selectedCell}
          >
            <div className="flex-1 overflow-auto border-t min-h-0 relative" ref={tableRef}>
            {/* Loading overlay when changing page size */}
            {isChangingPageSize && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  <span className="text-sm font-medium text-foreground">Loading rows...</span>
                </div>
              </div>
            )}
            <table className="w-full border-collapse bg-background">
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  {/* Row number header */}
                  <th className="w-12 p-2 border border-border bg-muted text-center text-xs font-medium text-muted-foreground">
                    #
                  </th>
                  {/* Checkbox header */}
                  <th className="w-12 p-2 border border-border bg-muted text-center">
                    <input
                      type="checkbox"
                      checked={isVirtualScrolling ? 
                        // Check if we have the special flag for selecting all 10000 rows OR if actual count matches
                        (file.selectedRowIds?.includes(`__SELECT_FIRST_${Math.min(file.rowsPerPage, file.totalRows || file.rowsPerPage)}__`) || 
                         file.selectedRows.length === Math.min(file.rowsPerPage, file.totalRows || file.rowsPerPage)) :
                        file.selectedRows.length === pageData.length && pageData.length > 0
                      }
                      onChange={() => {
                        if (isVirtualScrolling) {
                          // In virtual scrolling mode (10000 rows), select all 10000
                          const expectedCount = Math.min(file.rowsPerPage, file.totalRows || file.rowsPerPage);
                          if (file.selectedRowIds?.includes(`__SELECT_FIRST_${expectedCount}__`) || 
                              file.selectedRows.length === expectedCount) {
                            onRowSelect(-1); // Clear all
                          } else {
                            onRowSelect(-3); // Select all 10000 rows
                          }
                        } else {
                          // Normal mode
                          if (file.selectedRows.length === pageData.length && pageData.length > 0) {
                            onRowSelect(-1); // Clear all
                          } else {
                            onRowSelect(-2); // Select visible page rows
                          }
                        }
                      }}
                      className="rounded border-border"
                    />
                  </th>
                  {/* Column headers */}
                  {file.headers.map((header, colIndex) => (
                    <th
                      key={header}
                      className={cn(
                        "p-2 border border-border bg-muted text-left text-xs font-medium text-foreground cursor-pointer select-none relative group",
                        isCellSelected(-1, colIndex) && "bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                      )}
                      style={{ minWidth: `${getColumnWidth(header)}px` }}
                      onClick={() => handleCellClick(-1, colIndex)}
                      onDoubleClick={() => handleCellDoubleClick(-1, colIndex)}
                    >
                      {isCellEditing(-1, colIndex) ? (
                        <Input
                          ref={editInputRef}
                          value={editingCell?.value || ''}
                          onChange={(e) => {
                            onCellEdit(null, header, e.target.value);
                            setEditingCell({ rowIndex: null, header, value: e.target.value });
                          }}
                          onBlur={() => {
                            onCellSave();
                            setIsEditing(false);
                          }}
                          onKeyDown={(e) => {
                            // Prevent the global keydown handler from interfering
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              onCellSave();
                              setIsEditing(false);
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                              setIsEditing(false);
                            }
                          }}
                          className="h-6 text-xs border-0 p-0 focus:ring-0"
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="truncate">
                            {header.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </span>
                          {!['Call_ID', 'call_status', 'interest', 'call_notes'].includes(header) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteColumn(header);
                              }}
                              className="h-4 w-4 p-0 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Icon name="trash-2" className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startWidth = getColumnWidth(header);
                          
                          const handleMouseMove = (e: MouseEvent) => {
                            const newWidth = Math.max(80, startWidth + (e.clientX - startX));
                            handleColumnResize(header, newWidth);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-background">
                {pageData.map((row, rowIndex) => {
                  const actualRowIndex = ((file.currentPage - 1) * file.rowsPerPage) + rowIndex;
                  return (
                    <tr
                      key={actualRowIndex}
                      className={cn(
                        "hover:bg-accent transition-colors",
                        file.selectedRows.includes(actualRowIndex) && "bg-blue-50 dark:bg-blue-900/20"
                      )}
                    >
                      {/* Row number */}
                      <td className="w-12 p-2 border border-border bg-muted text-center text-xs font-medium text-muted-foreground">
                        {actualRowIndex + 1}
                      </td>
                      {/* Checkbox */}
                      <td className="w-12 p-2 border border-border text-center">
                        <input
                          type="checkbox"
                          checked={file.selectedRows.includes(actualRowIndex)}
                          onChange={() => onRowSelect(actualRowIndex)}
                          className="rounded border-border"
                        />
                      </td>
                      {/* Data cells */}
                      {file.headers.map((header, colIndex) => (
                        <td
                          key={`${actualRowIndex}-${header}`}
                          className={cn(
                            "p-1 border border-border text-xs cursor-cell relative group",
                            isCellSelected(rowIndex, colIndex) && "bg-blue-100 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 border-2",
                            copiedCell?.row === rowIndex && copiedCell?.col === colIndex && "bg-green-50 border-green-300"
                          )}
                          style={{ minWidth: `${getColumnWidth(header)}px` }}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                        >
                          {isCellEditing(rowIndex, colIndex) ? (
                            <Input
                              ref={editInputRef}
                              value={editingCell?.value || ''}
                              onChange={(e) => {
                                onCellEdit(actualRowIndex, header, e.target.value);
                                setEditingCell({ rowIndex: actualRowIndex, header, value: e.target.value });
                              }}
                              onBlur={() => {
                                onCellSave();
                                setIsEditing(false);
                              }}
                              onKeyDown={(e) => {
                                // Prevent the global keydown handler from interfering
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  onCellSave();
                                  setIsEditing(false);
                                }
                                if (e.key === 'Escape') {
                                  setEditingCell(null);
                                  setIsEditing(false);
                                }
                              }}
                              className="h-6 text-xs border-0 p-1 focus:ring-0 w-full bg-background"
                            />
                          ) : (
                            <div className="p-1 min-h-[24px] flex items-center">
                              {typeof getCellValue(rowIndex, header) === 'string' ? (
                                <span className="truncate" title={getCellValue(rowIndex, header) as string}>
                                  {getCellValue(rowIndex, header) || '-'}
                                </span>
                              ) : (
                                getCellValue(rowIndex, header)
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {/* Loading indicator for virtual scrolling */}
                {isVirtualScrolling && isLoadingMore && (
                  <tr>
                    <td colSpan={file.headers.length + 2} className="text-center p-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        <span className="text-sm text-muted-foreground">Loading more rows...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </ExcelContextMenu>
        </CardContent>
      </Card>

      {/* Compact Keyboard shortcuts */}
      <div className="flex-shrink-0 flex items-center justify-center gap-4 text-xs text-muted-foreground bg-muted border rounded p-2">
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">↑↓←→</kbd>
          <span>Navigate</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">Enter</kbd>
          <span>Edit</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">Tab</kbd>
          <span>Next</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">Ctrl+C</kbd>
          <span>Copy</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">Ctrl+V</kbd>
          <span>Paste</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">Del</kbd>
          <span>Clear</span>
        </div>
      </div>

      {/* Compact Pagination */}
      <div className="flex-shrink-0 flex items-center justify-between bg-background border rounded p-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {isVirtualScrolling ? (
              <>
                Showing {file.data.length} of {totalRows} rows
                {file.data.length < totalRows && ' (scroll for more)'}
              </>
            ) : (
              <>
                {((file.currentPage - 1) * file.rowsPerPage) + 1}-{Math.min(file.currentPage * file.rowsPerPage, totalRows)} of {totalRows}
              </>
            )}
          </span>
          {file.selectedRows.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {file.selectedRows.length} selected
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(file.id, 1)}
            disabled={file.currentPage === 1}
            className="h-7 w-7 p-0"
            title="First page"
          >
            <ChevronFirstIcon className='h-3 w-3'/>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(file.id, file.currentPage - 1)}
            disabled={file.currentPage === 1}
            className="h-7 w-7 p-0"
            title="Previous page"
          >
            <ChevronLeftIcon className='h-3 w-3'/>
          </Button>
          <span className="text-xs font-medium px-2 py-1 bg-muted rounded">
            {file.currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(file.id, file.currentPage + 1)}
            disabled={file.currentPage === totalPages}
            className="h-7 w-7 p-0"
            title="Next page"
          >
            <ChevronRightIcon className='h-3 w-3'/>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(file.id, totalPages)}
            disabled={file.currentPage === totalPages}
            className="h-7 w-7 p-0"
            title="Last page"
          >
            <ChevronLastIcon className='h-3 w-3'/>
          </Button>
          
          <Select
            value={file.rowsPerPage.toString()}
            onValueChange={(value) => onRowsPerPageChange(file.id, parseInt(value))}
            disabled={isChangingPageSize}
          >
            <SelectTrigger className="w-[100px] h-7 text-xs" disabled={isChangingPageSize}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100,1000,10000].map(size => (
                <SelectItem key={size} value={size.toString()}>
                  {size}/page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}