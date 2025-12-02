export interface ColumnTransformation {
  id: string;
  prompt: string;
  code: string;
  description: string;
  createdAt: Date;
  sourceColumns?: string[];
}

export interface SmartColumn {
  id: string;
  name: string;
  transformation: ColumnTransformation;
  values: any[];
}

export interface DataGridItem {
  [key: string]: any;
}

export interface ColumnMetadata {
  name: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array' | 'unknown';
  examples: any[];
  statistics?: {
    min?: number | string;
    max?: number | string;
    average?: number;
    uniqueValues?: number;
    emptyValues?: number;
    commonPatterns?: string[];
  };
  semanticType?: 'email' | 'phone' | 'name' | 'address' | 'date' | 'currency' | 'percentage' | 'identifier' | 'custom';
}

export interface SmartColumnGeneratorProps {
  data: DataGridItem[];
  onAddSmartColumn?: (name: string, values: any[]) => void;
}

export interface GeminiResponse {
  code: string;
  columnName: string;
  description: string;
  results: any[];
  reasoning: string;
}

export interface GeminiRequestBody {
  prompt: string;
  columns: string[];
  columnMetadata?: ColumnMetadata[];
  sampleData: DataGridItem[];
  apiKey?: string;
} 