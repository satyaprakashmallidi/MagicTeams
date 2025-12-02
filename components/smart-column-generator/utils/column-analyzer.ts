import { ColumnMetadata, DataGridItem } from '../types';

/**
 * Analyzes a data column and generates metadata about its type and characteristics
 * 
 * @param columnName The name of the column to analyze
 * @param data The data containing the column
 * @param sampleSize The number of examples to include in metadata
 * @returns Metadata about the column
 */
export function analyzeColumn(
  columnName: string, 
  data: DataGridItem[],
  sampleSize: number = 5
): ColumnMetadata {
  // Skip analysis if no data
  if (data.length === 0) {
    return {
      name: columnName,
      dataType: 'unknown',
      examples: [],
    };
  }

  // Extract values for this column
  const values = data.map(item => item[columnName]);
  const nonNullValues = values.filter(v => v !== null && v !== undefined);
  
  // Determine data type
  const dataType = determineDataType(nonNullValues);
  
  // Generate examples (take a diverse set if possible)
  const examples = generateExamples(nonNullValues, sampleSize);
  
  // Generate statistics based on data type
  const statistics = generateStatistics(nonNullValues, dataType);
  
  // Determine semantic type
  const semanticType = determineSemanticType(columnName, nonNullValues);
  
  return {
    name: columnName,
    dataType,
    examples,
    statistics,
    semanticType,
  };
}

/**
 * Determines the data type of a column
 */
function determineDataType(values: any[]): ColumnMetadata['dataType'] {
  if (values.length === 0) return 'unknown';
  
  const types = values.map(value => {
    if (value === null || value === undefined) return 'unknown';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      // Check if it's a date
      if (!isNaN(Date.parse(value))) return 'date';
      return 'string';
    }
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  });
  
  // Find the most common type
  const typeCounts: Record<string, number> = {};
  types.forEach(type => {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  // Sort by count and return the most common
  const mostCommonType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  return mostCommonType as ColumnMetadata['dataType'];
}

/**
 * Generates statistics for a column
 */
function generateStatistics(values: any[], dataType: ColumnMetadata['dataType']) {
  if (values.length === 0) return {};

  const statistics: ColumnMetadata['statistics'] = {
    uniqueValues: new Set(values).size,
    emptyValues: values.filter(v => v === '' || v === null || v === undefined).length,
  };

  if (dataType === 'number') {
    const numericValues = values.filter(v => typeof v === 'number') as number[];
    if (numericValues.length > 0) {
      statistics.min = Math.min(...numericValues);
      statistics.max = Math.max(...numericValues);
      statistics.average = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    }
  } else if (dataType === 'string') {
    const stringValues = values.filter(v => typeof v === 'string') as string[];
    if (stringValues.length > 0) {
      // Get min/max string lengths
      statistics.min = Math.min(...stringValues.map(s => s.length));
      statistics.max = Math.max(...stringValues.map(s => s.length));
      
      // Identify common patterns
      statistics.commonPatterns = findCommonPatterns(stringValues);
    }
  } else if (dataType === 'date') {
    try {
      const dateValues = values
        .filter(v => !isNaN(Date.parse(v)))
        .map(v => new Date(v).getTime());
      
      if (dateValues.length > 0) {
        statistics.min = new Date(Math.min(...dateValues)).toISOString();
        statistics.max = new Date(Math.max(...dateValues)).toISOString();
      }
    } catch (e) {
      // Ignore date parsing errors
    }
  }
  
  return statistics;
}

/**
 * Finds common patterns in string values
 */
function findCommonPatterns(values: string[]): string[] {
  const patterns: Record<string, number> = {};
  
  // Check for email pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailCount = values.filter(v => emailRegex.test(v)).length;
  if (emailCount > 0) patterns['email'] = emailCount;
  
  // Check for phone pattern
  const phoneRegex = /^[\d\s\(\)\-\+]+$/;
  const phoneCount = values.filter(v => phoneRegex.test(v) && v.replace(/\D/g, '').length >= 7).length;
  if (phoneCount > 0) patterns['phone'] = phoneCount;
  
  // Check for URL pattern
  const urlRegex = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
  const urlCount = values.filter(v => urlRegex.test(v)).length;
  if (urlCount > 0) patterns['url'] = urlCount;
  
  // Convert to array and sort by frequency
  return Object.entries(patterns)
    .sort((a, b) => b[1] - a[1])
    .map(([pattern]) => pattern)
    .slice(0, 3);
}

/**
 * Determines the semantic type of a column based on name and values
 */
function determineSemanticType(
  columnName: string,
  values: any[]
): ColumnMetadata['semanticType'] {
  const name = columnName.toLowerCase();
  
  // Check column name for common patterns
  if (name.includes('email')) return 'email';
  if (name.includes('phone')) return 'phone';
  if (name.includes('name') && !name.includes('file')) return 'name';
  if (name.includes('address')) return 'address';
  if (name.includes('date') || name.includes('time')) return 'date';
  if (name.includes('price') || name.includes('cost') || name.includes('amount')) return 'currency';
  if (name.includes('percent')) return 'percentage';
  if (name.includes('id') && name !== 'idea' && name !== 'identify') return 'identifier';
  
  // If column name doesn't give enough clues, check the values
  if (values.length > 0) {
    const sampleValue = values[0];
    
    if (typeof sampleValue === 'string') {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sampleValue)) return 'email';
      if (/^[\d\s\(\)\-\+]{7,}$/.test(sampleValue)) return 'phone';
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(sampleValue)) return 'date';
      if (/^\$\d+(\.\d{2})?$/.test(sampleValue)) return 'currency';
      if (/^\d+%$/.test(sampleValue)) return 'percentage';
    }
  }
  
  return 'custom';
}

/**
 * Generates a diverse set of examples from the values
 */
function generateExamples(values: any[], count: number): any[] {
  if (values.length <= count) return values;
  
  // Try to get a diverse set by sampling at regular intervals
  const step = Math.floor(values.length / count);
  const examples = [];
  
  for (let i = 0; i < count; i++) {
    examples.push(values[i * step]);
  }
  
  return examples;
}

/**
 * Analyzes all columns in a dataset and returns metadata for each
 */
export function analyzeData(data: DataGridItem[]): ColumnMetadata[] {
  if (data.length === 0) return [];
  
  const columns = Object.keys(data[0]);
  return columns.map(column => analyzeColumn(column, data));
} 