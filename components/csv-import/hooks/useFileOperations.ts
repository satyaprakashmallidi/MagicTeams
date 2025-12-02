import { useState, useCallback } from 'react';
import { CSVFile } from '../types';
import { supabase } from '@/lib/supabase';

export const useFileOperations = (userId: string | null) => {
  const [error, setError] = useState<string | null>(null);

  const deleteFile = useCallback(async (fileId: string) => {
    if (!userId) return;

    try {
      setError(null);
      // Delete file and its rows from database
      const { error: rowsError } = await supabase
        .from('file_rows')
        .delete()
        .eq('file_id', fileId);

      if (rowsError) throw rowsError;

      const { error: fileError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', userId);

      if (fileError) throw fileError;

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      setError('Failed to delete file from database');
      return false;
    }
  }, [userId]);

  const updateColumn = useCallback(async (fileId: string, oldHeader: string, newHeader: string) => {
    if (!userId) return;

    try {
      setError(null);
      // Get all rows for this file
      const { data: rows, error: fetchError } = await supabase
        .from('files')
        .select('headers')
        .eq('id', fileId);

      if (fetchError) throw fetchError;

      let newRowData = [...rows[0].headers];
      newRowData[newRowData.indexOf(oldHeader)] = newHeader;

      const { error } = await supabase
        .from('files')
        .update({ headers: newRowData })
        .eq('id', fileId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating column name:', error);
      setError('Failed to update column name in database');
      return false;
    }
  }, [userId]);

  const deleteColumn = useCallback(async (fileId: string, columnName: string) => {
    if (!userId) return;

    try {
      setError(null);
      // Get all rows for this file
      const { data, error: fetchError } = await supabase
        .from('files')
        .select('headers')
        .eq('id', fileId);

      if (fetchError) throw fetchError;

      const newRowData = [...(data[0].headers)];
      if (newRowData.includes(columnName)) {
        newRowData.splice(newRowData.indexOf(columnName), 1);
      }

      const { error } = await supabase
        .from('files')
        .update({ headers: newRowData })
        .eq('id', fileId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting column:', error);
      setError('Failed to delete column from database');
      return false;
    }
  }, [userId]);

  return {
    error,
    deleteFile,
    updateColumn,
    deleteColumn,
  };
};
