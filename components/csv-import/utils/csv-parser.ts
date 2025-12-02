import Papa from 'papaparse';
import { CSVFile } from '../types';

export const parseCSVFile = (file: File, currentPage: number = 1, rowsPerPage: number = 10): Promise<CSVFile> => {
  return new Promise((resolve, reject) => {
    const text = file.text();
    
    text.then((content) => {
      // First detect the delimiter by checking first few lines
      const firstLines = content.split('\n').slice(0, 5).join('\n');
      const possibleDelimiters = [',', ';', '\t', '|'];
      let bestDelimiter = ',';
      let maxColumns = 0;

      for (const delimiter of possibleDelimiters) {
        const columns = firstLines.split('\n')[0].split(delimiter).length;
        if (columns > maxColumns) {
          maxColumns = columns;
          bestDelimiter = delimiter;
        }
      }

      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        delimiter: bestDelimiter,
        transformHeader: (header) => {
          return header.trim().replace(/['"]/g, '');
        },
        transform: (value) => {
          return value.trim().replace(/['"]/g, '');
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            const errorMessages = results.errors
              .map(err => `${err.message} (row: ${err.row || 'unknown'})`)
              .join('; ');
            reject(new Error(`Error parsing ${file.name}: ${errorMessages}`));
            return;
          }

          const parsedData = results.data as Record<string, string>[];
          if (parsedData.length === 0) {
            reject(new Error(`No data found in ${file.name}`));
            return;
          }

          const firstRow = parsedData[0];
          if (!firstRow || Object.keys(firstRow).length <= 1) {
            reject(new Error(`Invalid CSV format in ${file.name}. Please check the file format and delimiter.`));
            return;
          }

          // Store original column order
          const originalHeaders = Object.keys(firstRow);
          
          // Add required columns if they don't exist
          const requiredColumns = ['Call_ID', 'call_status', 'interest', 'call_notes'];
          requiredColumns.forEach(col => {
            if(!originalHeaders.includes(col)){
              parsedData.forEach(row => row[col] = col === 'Call_ID' ? "null" : 
                                                  col === 'call_status' ? 'not_called' :
                                                  col === 'interest' ? 'not_specified' : '');
            }
          });

          // Combine original headers with required columns while maintaining order
          const headers = [
            ...originalHeaders.filter(h => !requiredColumns.includes(h)),
            ...requiredColumns
          ];

          const csvFile: CSVFile = {
            id: crypto.randomUUID(),
            name: file.name,
            data: parsedData,
            headers: headers,
            selectedRows: [],
            selectedRowIds: [],
            currentPage,
            rowsPerPage,
            totalRows: parsedData.length,
            isDataLoaded: true
          };

          resolve(csvFile);
        },
        error: (error) => {
          reject(new Error(`Error parsing ${file.name}: ${error.message}`));
        }
      });
    }).catch(reject);
  });
};
