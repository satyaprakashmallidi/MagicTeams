export interface CSVFile {
  id: string;
  name: string;
  headers: string[];
  data: Array<Record<string, string> & { dbId?: string }>;
  selectedRows: number[];
  currentPage: number;
  rowsPerPage: number;
}

export interface EditingCell {
  rowIndex: number | null;
  header: string;
  value: string;
}
