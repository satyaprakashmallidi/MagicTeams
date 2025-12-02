import { supabase } from '@/lib/supabase';
import { CSVFile } from '../types';

export const syncFileToDatabase = async (
  file: CSVFile, 
  userId: string, 
  folderId?: string | null,
  onProgress?: (progress: number) => void
) => {
  try {
    // Insert file metadata
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .insert([
        {
          id: file.id,
          name: file.name,
          user_id: userId,
          headers : file.headers,
          folder_id: folderId
        }
      ])
      .select()
      .single();

    if (fileError) throw fileError;

    // Prepare rows for insertion
    const rowsToInsert = file.data.map(row => ({
      file_id: file.id,
      row_data: {
        ...row,
        __headers: file.headers
      }
    }));

    // Batch insert rows in chunks to avoid timeout
    const BATCH_SIZE = 100; // Process 100 rows at a time
    const totalBatches = Math.ceil(rowsToInsert.length / BATCH_SIZE);
    const allInsertedRows = [];

    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      
      const { data: batchData, error: batchError } = await supabase
        .from('file_rows')
        .insert(batch)
        .select();

      if (batchError) {
        // If batch fails, try inserting one by one for this batch
        console.warn(`Batch insert failed at rows ${i}-${i + batch.length}, trying individual inserts:`, batchError);
        
        for (const row of batch) {
          try {
            const { data: singleData, error: singleError } = await supabase
              .from('file_rows')
              .insert([row])
              .select()
              .single();
            
            if (singleError) {
              console.error(`Failed to insert row:`, singleError);
            } else if (singleData) {
              allInsertedRows.push(singleData);
            }
          } catch (singleError) {
            console.error(`Failed to insert single row:`, singleError);
          }
        }
      } else if (batchData) {
        allInsertedRows.push(...batchData);
      }

      // Report progress
      if (onProgress) {
        const progress = Math.min(((i + BATCH_SIZE) / rowsToInsert.length) * 100, 100);
        onProgress(progress);
      }
    }

    // Update file data with row IDs
    file.data = file.data.map((row, index) => ({
      ...row,
      dbId: allInsertedRows[index]?.id
    }));

    return file;
  } catch (error) {
    console.error('Error syncing to database:', error);
    throw error;
  }
};

export const fetchFilesFromDatabase = async (userId: string): Promise<CSVFile[]> => {
  try {
    // Fetch only file metadata with folder information and row counts
    const { data: filesData, error: filesError } = await supabase
      .from('files')
      .select(`
        id,
        name,
        user_id,
        headers,
        folder_id,
        created_at,
        folders:folder_id(*),
        file_rows(count)
      `)
      .eq('user_id', userId);

    if (filesError) throw filesError;
    if (!filesData) return [];

    const csvFiles: CSVFile[] = filesData.map(fileData => {
      const totalRows = fileData.file_rows?.[0]?.count || 0;

      return {
        id: fileData.id,
        name: fileData.name,
        headers: fileData.headers || [],
        data: [], // Initially empty - will be loaded lazily when file is selected
        selectedRows: [],
        selectedRowIds: [], // Track actual database row IDs
        currentPage: 1,
        rowsPerPage: 10,
        folder_id: fileData.folder_id,
        folder: fileData.folders || null,
        totalRows: totalRows, // Store total row count for pagination
        isDataLoaded: false // Track if data has been loaded
      };
    });

    return csvFiles;
  } catch (error) {
    console.error('Error fetching files metadata:', error);
    throw error;
  }
};

// New function to load data for a specific file with pagination
export const fetchFileData = async (
  fileId: string, 
  userId: string, 
  page: number = 1, 
  rowsPerPage: number = 10
): Promise<{ data: any[], totalRows: number }> => {
  try {
    // Verify user has access to this file
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('id, headers')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found or access denied');

    // Get total count
    const { count, error: countError } = await supabase
      .from('file_rows')
      .select('*', { count: 'exact', head: true })
      .eq('file_id', fileId);

    if (countError) throw countError;

    const totalRows = count || 0;

    // Calculate offset for pagination
    const offset = (page - 1) * rowsPerPage;

    // For 10000 rows, we'll use virtual scrolling with initial batch of 1000
    // For 1000 or less, fetch the full amount
    const actualFetchSize = rowsPerPage === 10000 ? 1000 : rowsPerPage;
    
    // Fetch paginated data
    const { data: rowsData, error: rowsError } = await supabase
      .from('file_rows')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: true })
      .range(offset, offset + actualFetchSize - 1);

    if (rowsError) throw rowsError;

    // Map the data, excluding the __headers field
    const data = (rowsData || []).map(row => {
      const rowData = { ...row.row_data };
      delete rowData.__headers;
      return {
        ...rowData,
        dbId: row.id
      };
    });

    return { data, totalRows };
  } catch (error) {
    console.error('Error fetching file data:', error);
    throw error;
  }
};

// New function to load specific rows by their database IDs for campaigns
// Function to fetch additional rows for lazy loading
export const fetchAdditionalRows = async (
  fileId: string,
  userId: string,
  startOffset: number,
  batchSize: number = 1000
): Promise<any[]> => {
  try {
    // Verify user has access to this file
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('id')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found or access denied');

    // Fetch the batch of rows
    const { data: rowsData, error: rowsError } = await supabase
      .from('file_rows')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: true })
      .range(startOffset, startOffset + batchSize - 1);

    if (rowsError) throw rowsError;

    // Map the data, excluding the __headers field
    const data = (rowsData || []).map(row => {
      const rowData = { ...row.row_data };
      delete rowData.__headers;
      return {
        ...rowData,
        dbId: row.id
      };
    });

    return data;
  } catch (error) {
    console.error('Error fetching additional rows:', error);
    throw error;
  }
};

export const fetchSelectedRows = async (
  fileId: string, 
  userId: string, 
  rowDbIds: string[]
): Promise<any[]> => {
  try {
    // Verify user has access to this file
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('id')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found or access denied');

    if (!rowDbIds || rowDbIds.length === 0) {
      return [];
    }

    // Check for special __SELECT_FIRST_N__ flag
    const selectFirstMatch = rowDbIds[0]?.match(/^__SELECT_FIRST_(\d+)__$/);
    if (selectFirstMatch) {
      const numRows = parseInt(selectFirstMatch[1], 10);
      
      // Fetch the first N rows from the file
      let allRows: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let rowsToFetch = numRows;

      while (rowsToFetch > 0) {
        const currentBatchSize = Math.min(batchSize, rowsToFetch);
        
        const { data: batchData, error: batchError } = await supabase
          .from('file_rows')
          .select('*')
          .eq('file_id', fileId)
          .order('created_at', { ascending: true })
          .range(offset, offset + currentBatchSize - 1);

        if (batchError) throw batchError;
        if (!batchData || batchData.length === 0) break;

        allRows = [...allRows, ...batchData];
        offset += batchData.length;
        rowsToFetch -= batchData.length;

        // Break if we got fewer rows than expected (end of data)
        if (batchData.length < currentBatchSize) break;
      }

      // Map the data, excluding the __headers field
      return allRows.map(row => {
        const rowData = { ...row.row_data };
        delete rowData.__headers;
        return {
          ...rowData,
          dbId: row.id
        };
      });
    }

    // Fetch specific rows by their database IDs
    const { data: rowsData, error: rowsError } = await supabase
      .from('file_rows')
      .select('*')
      .eq('file_id', fileId)
      .in('id', rowDbIds);

    if (rowsError) throw rowsError;

    // Map the data, excluding the __headers field
    const data = (rowsData || []).map(row => {
      const rowData = { ...row.row_data };
      delete rowData.__headers;
      return {
        ...rowData,
        dbId: row.id
      };
    });

    return data;
  } catch (error) {
    console.error('Error fetching selected rows:', error);
    throw error;
  }
};

export const updateFilePagination = async (fileId: string, currentPage: number, rowsPerPage: number) => {
  // Since we don't have pagination columns yet, we'll just return
  return;
};