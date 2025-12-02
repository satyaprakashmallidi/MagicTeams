export interface DataRow {
  [key: string]: string | null;
  call_id?: string | null;
  call_status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'not_called';
  interest?: 'not_specified' | 'interested' | 'not_interested';
  call_notes?: string;
  dbId?: string;
}

export interface Folder {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CSVFile {
  id: string;
  name: string;
  data: DataRow[];
  headers: string[];
  selectedRows: number[]; // Page-level indices for UI
  selectedRowIds: string[]; // Database row IDs for campaigns
  currentPage: number;
  rowsPerPage: number;
  folder_id?: string | null;
  folder?: Folder | null;
  totalRows?: number; // Total number of rows in the database
  isDataLoaded?: boolean; // Track if data has been loaded for lazy loading
}

export interface EditingCell {
  rowIndex: number | null;
  header: string;
  value: string;
}
