'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DataGridItem, SmartColumn, ColumnTransformation, ColumnMetadata } from '../types';
import { ColumnPrompt } from './column-prompt';
import { TransformationDetails } from './transformation-details';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { analyzeData } from '../utils/column-analyzer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Filter, SortAsc, SortDesc, X } from 'lucide-react';

interface SmartDataGridProps {
  data: DataGridItem[];
  title?: string;
  geminiApiKey?: string;
}

type SortDirection = 'asc' | 'desc' | null;
type FilterType = 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';

interface ColumnSorting {
  columnName: string;
  direction: SortDirection;
}

interface ColumnFilter {
  columnName: string;
  value: string;
  type: FilterType;
  active: boolean;
}

export function SmartDataGrid({ 
  data, 
  title = 'Smart Data Grid',
  geminiApiKey 
}: SmartDataGridProps) {
  const [gridData, setGridData] = useState<DataGridItem[]>(data);
  const [smartColumns, setSmartColumns] = useState<SmartColumn[]>([]);
  const [activeTransformation, setActiveTransformation] = useState<ColumnTransformation | null>(null);
  const [columnMetadata, setColumnMetadata] = useState<ColumnMetadata[]>([]);
  const [sorting, setSorting] = useState<ColumnSorting | null>(null);
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [showFilterDialog, setShowFilterDialog] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<DataGridItem[]>([]);
  const [selectedCell, setSelectedCell] = useState<{row: number, col: string} | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{row: number, col: string} | null>(null);
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  
  // Helper function to ensure cell values are rendered properly
  const formatCellValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return value;
  };

  // Get the headers from the first row of data
  const headers = gridData.length > 0 
    ? Object.keys(gridData[0]) 
    : [];

  // Analyze column metadata when data changes
  useEffect(() => {
    if (gridData.length > 0) {
      const metadata = analyzeData(gridData);
      setColumnMetadata(metadata);
      console.log('Column metadata generated:', metadata);
    }
  }, [gridData]);

  // Apply sorting and filtering
  useEffect(() => {
    let result = [...gridData];
    
    // Apply filters
    const activeFilters = Object.values(filters).filter(f => f.active);
    if (activeFilters.length > 0) {
      result = result.filter(row => {
        return activeFilters.every(filter => {
          const value = row[filter.columnName];
          const filterValue = filter.value;
          
          if (value === undefined || value === null) return false;
          
          const stringValue = String(value).toLowerCase();
          const stringFilterValue = String(filterValue).toLowerCase();
          
          switch (filter.type) {
            case 'contains':
              return stringValue.includes(stringFilterValue);
            case 'equals':
              return stringValue === stringFilterValue;
            case 'startsWith':
              return stringValue.startsWith(stringFilterValue);
            case 'endsWith':
              return stringValue.endsWith(stringFilterValue);
            case 'greaterThan':
              return Number(value) > Number(filterValue);
            case 'lessThan':
              return Number(value) < Number(filterValue);
            default:
              return true;
          }
        });
      });
    }
    
    // Apply sorting
    if (sorting && sorting.direction) {
      result.sort((a, b) => {
        const aValue = a[sorting.columnName];
        const bValue = b[sorting.columnName];
        
        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return sorting.direction === 'asc' ? -1 : 1;
        if (bValue === null || bValue === undefined) return sorting.direction === 'asc' ? 1 : -1;
        
        const comparison = aValue < bValue ? -1 : 1;
        return sorting.direction === 'asc' ? comparison : -comparison;
      });
    }
    
    setProcessedData(result);
  }, [gridData, sorting, filters]);

  // Create a new smart column
  const handleGenerateColumn = (
    columnName: string,
    values: any[],
    code: string,
    description: string,
    prompt: string,
    sourceColumns: string[] = []
  ) => {
    console.log('[SmartDataGrid.handleGenerateColumn] Starting with columnName:', columnName);
    console.log('[SmartDataGrid.handleGenerateColumn] Values length:', values?.length);
    console.log('[SmartDataGrid.handleGenerateColumn] Code available:', !!code?.length);
    console.log('[SmartDataGrid.handleGenerateColumn] Description:', description);
    console.log('[SmartDataGrid.handleGenerateColumn] Source columns:', sourceColumns);
    
    if (values.length !== gridData.length) {
      console.error('[SmartDataGrid.handleGenerateColumn] Values length mismatch:', 
        `values: ${values.length}, gridData: ${gridData.length}`);
      toast({
        title: 'Error',
        description: 'Generated values do not match the number of rows in the data',
        variant: 'destructive',
      });
      return;
    }

    // Create unique column name if it already exists
    let finalColumnName = columnName;
    let counter = 1;
    
    while (
      gridData.length > 0 && 
      Object.keys(gridData[0]).includes(finalColumnName) ||
      smartColumns.some(col => col.name === finalColumnName)
    ) {
      console.log('[SmartDataGrid.handleGenerateColumn] Column name already exists, incrementing:', finalColumnName);
      finalColumnName = `${columnName}_${counter}`;
      counter++;
    }
    
    console.log('[SmartDataGrid.handleGenerateColumn] Final column name:', finalColumnName);

    // Create the transformation object
    const transformation: ColumnTransformation = {
      id: uuidv4(),
      prompt,
      code: code || `// Direct value generation from prompt: "${prompt}"`,
      description,
      createdAt: new Date(),
      sourceColumns
    };
    console.log('[SmartDataGrid.handleGenerateColumn] Created transformation with ID:', transformation.id);

    // Create the smart column
    const newSmartColumn: SmartColumn = {
      id: uuidv4(),
      name: finalColumnName,
      transformation,
      values,
    };
    console.log('[SmartDataGrid.handleGenerateColumn] Created smart column with ID:', newSmartColumn.id);

    // Add the smart column
    console.log('[SmartDataGrid.handleGenerateColumn] Adding to smartColumns state');
    setSmartColumns(prev => [...prev, newSmartColumn]);

    // Add the new column to the grid data
    console.log('[SmartDataGrid.handleGenerateColumn] Updating gridData with new column');
    setGridData(prev => 
      prev.map((row, index) => ({
        ...row,
        [finalColumnName]: values[index]
      }))
    );

    // Re-analyze metadata after adding the new column
    console.log('[SmartDataGrid.handleGenerateColumn] Scheduling metadata re-analysis');
    setTimeout(() => {
      const updatedMetadata = analyzeData(gridData);
      console.log('[SmartDataGrid.handleGenerateColumn] Updated metadata:', updatedMetadata.length);
      setColumnMetadata(updatedMetadata);
    }, 0);

    console.log('[SmartDataGrid.handleGenerateColumn] Column generation complete');
  };

  const handleViewTransformation = (columnId: string) => {
    const column = smartColumns.find(col => col.id === columnId);
    if (column) {
      setActiveTransformation(column.transformation);
    }
  };

  // Initialize column deletion process - shows confirmation dialog
  const initiateColumnDeletion = (columnName: string) => {
    setColumnToDelete(columnName);
    setShowDeleteDialog(true);
  };

  // Check if this column is used as a source by any smart column
  const getColumnDependencies = (columnName: string): SmartColumn[] => {
    return smartColumns.filter(smartCol => 
      smartCol.transformation.sourceColumns?.includes(columnName)
    );
  };

  // Handle removing a column after confirmation, both smart and default ones
  const handleRemoveColumn = () => {
    if (!columnToDelete) return;
    
    const columnName = columnToDelete;
    
    // Check if it's a smart column
    const columnToRemove = smartColumns.find(col => col.name === columnName);
    
    // Remove the column from the smart columns list if applicable
    if (columnToRemove) {
      setSmartColumns(prev => prev.filter(col => col.id !== columnToRemove.id));
    }

    // Remove the column from the grid data - works for both smart and default columns
    setGridData(prev => 
      prev.map(row => {
        const newRow = { ...row };
        delete newRow[columnName];
        return newRow;
      })
    );

    // Remove any sorting or filtering for this column
    if (sorting?.columnName === columnName) {
      setSorting(null);
    }

    if (filters[columnName]) {
      const newFilters = { ...filters };
      delete newFilters[columnName];
      setFilters(newFilters);
    }
    
    // Remove from frozen columns if present
    if (frozenColumns.has(columnName)) {
      const newFrozenColumns = new Set(frozenColumns);
      newFrozenColumns.delete(columnName);
      setFrozenColumns(newFrozenColumns);
    }

    // Re-analyze metadata after removing the column
    setTimeout(() => {
      const updatedMetadata = analyzeData(gridData);
      setColumnMetadata(updatedMetadata);
    }, 0);

    // If this was the active transformation, clear it
    if (columnToRemove && activeTransformation && columnToRemove.transformation.id === activeTransformation.id) {
      setActiveTransformation(null);
    }

    toast({
      title: 'Column Removed',
      description: `"${columnName}" has been removed`,
    });
    
    // Reset the delete state
    setColumnToDelete(null);
    setShowDeleteDialog(false);
  };

  const toggleSort = (columnName: string) => {
    if (sorting?.columnName === columnName) {
      // Toggle direction or clear sorting
      if (sorting.direction === 'asc') {
        setSorting({ columnName, direction: 'desc' });
      } else if (sorting.direction === 'desc') {
        setSorting(null);
      }
    } else {
      // Set new sorting
      setSorting({ columnName, direction: 'asc' });
    }
  };

  const toggleFilter = (columnName: string) => {
    setShowFilterDialog(columnName);
  };

  const applyFilter = (columnName: string, value: string, type: FilterType) => {
    setFilters(prev => ({
      ...prev,
      [columnName]: {
        columnName,
        value,
        type,
        active: true
      }
    }));
    setShowFilterDialog(null);
  };

  const clearFilter = (columnName: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnName];
      return newFilters;
    });
  };

  const toggleFreezeColumn = (columnName: string) => {
    const newFrozenColumns = new Set(frozenColumns);
    if (newFrozenColumns.has(columnName)) {
      newFrozenColumns.delete(columnName);
    } else {
      newFrozenColumns.add(columnName);
    }
    setFrozenColumns(newFrozenColumns);
  };

  // Reorder headers to put frozen columns first
  const orderedHeaders = useMemo(() => {
    const frozen = headers.filter(header => frozenColumns.has(header));
    const nonFrozen = headers.filter(header => !frozenColumns.has(header));
    return [...frozen, ...nonFrozen];
  }, [headers, frozenColumns]);

  const isColumnActive = (columnName: string): boolean => {
    return (sorting?.columnName === columnName && sorting.direction !== null) || 
           !!filters[columnName]?.active;
  };

  const activeFiltersCount = Object.values(filters).filter(f => f.active).length;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      
      {/* Column Generator Prompt */}
      <div className="p-4 bg-white border rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Smart Column Generator</h3>
        <ColumnPrompt 
          data={gridData}
          columnMetadata={columnMetadata}
          onGenerateColumn={handleGenerateColumn}
          disabled={gridData.length === 0}
          geminiApiKey={geminiApiKey}
        />
      </div>

      {/* Filter Summary */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
          <span className="text-xs font-medium text-blue-700">Active Filters:</span>
          {Object.values(filters)
            .filter(f => f.active)
            .map((filter, idx) => (
              <Badge key={idx} variant="secondary" className="flex items-center gap-1 bg-white">
                <span className="font-medium">{filter.columnName}</span>
                <span className="text-xs">{filter.type}</span>
                <span>"{filter.value}"</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-4 w-4 p-0 text-gray-500 hover:text-red-500"
                  onClick={() => clearFilter(filter.columnName)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-blue-700 hover:text-blue-900"
            onClick={() => setFilters({})}
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Data Grid Controls */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500">
          {processedData.length} {processedData.length === 1 ? 'row' : 'rows'} • 
          {headers.length} {headers.length === 1 ? 'column' : 'columns'} 
          ({smartColumns.length} smart)
        </p>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <ChevronDown className="h-3 w-3 mr-1" />
              Manage Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Available Columns</p>
            </div>
            {headers.map(header => {
              const isSmartCol = smartColumns.some(col => col.name === header);
              return (
                <DropdownMenuItem key={header} className="flex justify-between items-center">
                  <span className="flex items-center">
                    {header}
                    {isSmartCol && (
                      <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">
                        SMART
                      </Badge>
                    )}
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 text-red-500"
                    onClick={() => {
                      initiateColumnDeletion(header);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transformation Details */}
      {activeTransformation && (
        <TransformationDetails 
          transformation={activeTransformation} 
          onClose={() => setActiveTransformation(null)} 
        />
      )}

      {/* Data Grid - Excel Style */}
      <div className="overflow-x-auto border rounded-lg shadow bg-white">
        <div className="relative">
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                {orderedHeaders.map((header, colIndex) => {
                  const isSmartColumn = smartColumns.some(col => col.name === header);
                  const metadata = columnMetadata.find(meta => meta.name === header);
                  const isFrozen = frozenColumns.has(header);
                  const sortDirection = sorting?.columnName === header ? sorting.direction : null;
                  const hasFilter = !!filters[header]?.active;
                  const isActive = isColumnActive(header);
                  
                  return (
                    <th 
                      key={header} 
                      className={`px-1 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-b border-gray-200 select-none
                        ${isFrozen ? 'sticky left-0 z-20 shadow-md bg-gray-100' : ''}
                        ${isActive ? 'bg-blue-50' : ''}
                        ${hoverCol === header ? 'bg-gray-200' : ''}
                      `}
                      title={metadata?.semanticType ? `Type: ${metadata.semanticType}` : undefined}
                      style={{ minWidth: '120px' }}
                      onMouseEnter={() => setHoverCol(header)}
                      onMouseLeave={() => setHoverCol(null)}
                    >
                      <div className="flex items-center justify-between gap-1 px-2">
                        <div className="flex items-center gap-1 flex-grow truncate">
                          {header}
                          {metadata?.semanticType && (
                            <span className="ml-1 text-xs text-gray-400 normal-case">
                              ({metadata.semanticType})
                            </span>
                          )}
                          {isSmartColumn && (
                            <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">
                              SMART
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1 whitespace-nowrap">
                          {sortDirection === 'asc' && <ChevronUp className="h-3 w-3 text-blue-600" />}
                          {sortDirection === 'desc' && <ChevronDown className="h-3 w-3 text-blue-600" />}
                          {hasFilter && <Filter className="h-3 w-3 text-blue-600" />}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              <DropdownMenuItem onClick={() => toggleSort(header)}>
                                <SortAsc className="mr-2 h-4 w-4" />
                                Sort A to Z
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSorting({ columnName: header, direction: 'desc' });
                              }}>
                                <SortDesc className="mr-2 h-4 w-4" />
                                Sort Z to A
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleFilter(header)}>
                                <Filter className="mr-2 h-4 w-4" />
                                Filter
                              </DropdownMenuItem>
                              {hasFilter && (
                                <DropdownMenuItem onClick={() => clearFilter(header)}>
                                  <X className="mr-2 h-4 w-4" />
                                  Clear Filter
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleFreezeColumn(header)}>
                                {isFrozen ? 'Unfreeze Column' : 'Freeze Column'}
                              </DropdownMenuItem>
                              
                              {isSmartColumn ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    const column = smartColumns.find(col => col.name === header);
                                    if (column) {
                                      handleViewTransformation(column.id);
                                    }
                                  }}>
                                    View Transformation
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => initiateColumnDeletion(header)}
                                className="text-red-500 focus:text-red-500"
                              >
                                Remove Column
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedData.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className={`
                    ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    ${hoverRow === rowIndex ? 'bg-gray-100' : ''}
                    ${selectedCell?.row === rowIndex ? 'bg-blue-50' : ''}
                  `}
                  onMouseEnter={() => setHoverRow(rowIndex)}
                  onMouseLeave={() => setHoverRow(null)}
                >
                  {orderedHeaders.map(header => {
                    const isSmartColumn = smartColumns.some(col => col.name === header);
                    const isFrozen = frozenColumns.has(header);
                    
                    // Determine if this is a transcript or summary column
                    const isTranscriptColumn = header.toLowerCase().includes('transcript');
                    const isSummaryColumn = header.toLowerCase().includes('summary');
                    
                    // Special styling for transcript and summary columns
                    const columnStyles = 
                      (isTranscriptColumn || isSummaryColumn) 
                        ? 'px-2 py-1 text-sm whitespace-normal break-words max-w-xs' 
                        : 'px-2 py-1 whitespace-nowrap text-sm';
                    
                    const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === header;
                    const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === header;
                    
                    return (
                      <td 
                        key={`${rowIndex}-${header}`} 
                        className={`
                          ${columnStyles} 
                          border-r border-b border-gray-200
                          ${isSmartColumn ? 'bg-blue-50' : ''}
                          ${isFrozen ? 'sticky left-0 z-10 shadow-md' : ''}
                          ${isSelected ? 'outline outline-2 outline-blue-500 z-30 relative' : ''}
                          ${isHovered || (hoverCol === header && hoverRow === rowIndex) ? 'bg-gray-100' : ''}
                          ${hoverCol === header ? 'bg-gray-50' : ''}
                        `}
                        onClick={() => setSelectedCell({ row: rowIndex, col: header })}
                        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: header })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {(isTranscriptColumn || isSummaryColumn) ? (
                          <div className="max-h-24 overflow-hidden line-clamp-3 text-ellipsis">
                            {formatCellValue(row[header])}
                          </div>
                        ) : (
                          formatCellValue(row[header])
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {gridData.length === 0 && (
        <div className="text-center p-8 bg-gray-50 border border-dashed rounded-lg">
          <p className="text-gray-500">No data available. Please import or add data to use the smart column generator.</p>
        </div>
      )}

      {/* Filter Dialog */}
      <Dialog open={!!showFilterDialog} onOpenChange={(open) => !open && setShowFilterDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Column: {showFilterDialog}</DialogTitle>
          </DialogHeader>
          
          {showFilterDialog && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <select 
                  className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  defaultValue="contains"
                  id="filter-type"
                >
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                  <option value="startsWith">Starts with</option>
                  <option value="endsWith">Ends with</option>
                  <option value="greaterThan">Greater than</option>
                  <option value="lessThan">Less than</option>
                </select>
                
                <Input id="filter-value" className="flex-1" placeholder="Filter value..." />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFilterDialog(null)}>Cancel</Button>
                <Button onClick={() => {
                  const filterType = (document.getElementById('filter-type') as HTMLSelectElement).value as FilterType;
                  const filterValue = (document.getElementById('filter-value') as HTMLInputElement).value;
                  if (filterValue && showFilterDialog) {
                    applyFilter(showFilterDialog, filterValue, filterType);
                  }
                }}>Apply Filter</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Column Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Column Removal</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
              {columnToDelete && (
                <>
                  Are you sure you want to remove the column <span className="font-bold">{columnToDelete}</span>?
                  {smartColumns.some(col => col.name === columnToDelete) 
                    ? " This is a smart column with a transformation that will also be removed." 
                    : " This is a default column and might contain important data."}
                </>
              )}
            </p>
            
            {/* Show dependencies warning */}
            {columnToDelete && getColumnDependencies(columnToDelete).length > 0 && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-700 font-medium">Warning: Column Dependencies</p>
                <p className="text-xs text-amber-600 mt-1">
                  This column is used by the following smart columns that may break if removed:
                </p>
                <ul className="mt-1 text-xs list-disc list-inside text-amber-700">
                  {getColumnDependencies(columnToDelete).map(col => (
                    <li key={col.id}>{col.name}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-sm text-red-500 mt-2">This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setColumnToDelete(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRemoveColumn}
            >
              Remove Column
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 