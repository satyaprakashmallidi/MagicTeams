import { supabase } from '@/lib/supabase';
import { Folder } from '../types';

export class FolderService {
  
  // Get all folders for a user
  static async getFolders(userId: string): Promise<Folder[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  // Create a new folder
  static async createFolder(name: string, userId: string): Promise<Folder> {
    const { data, error } = await supabase
      .from('folders')
      .insert([{ name, user_id: userId }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Update folder name
  static async updateFolder(folderId: string, name: string, userId: string): Promise<Folder> {
    const { data, error } = await supabase
      .from('folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', folderId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Delete a folder and move its files to uncategorized
  static async deleteFolder(folderId: string, userId: string): Promise<void> {
    // First, move all files in this folder to uncategorized (folder_id = null)
    const { error: filesError } = await supabase
      .from('files')
      .update({ folder_id: null })
      .eq('folder_id', folderId)
      .eq('user_id', userId);
    
    if (filesError) throw filesError;

    // Then delete the folder
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);
    
    if (error) throw error;
  }

  // Get or create "Uncategorized" folder (optional, for UI consistency)
  static async getOrCreateDefaultFolder(userId: string): Promise<Folder | null> {
    try {
      // Check if "Uncategorized" folder exists
      const { data: existing } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .eq('name', 'Uncategorized')
        .single();
      
      if (existing) return existing;

      // Create it if it doesn't exist
      return await this.createFolder('Uncategorized', userId);
    } catch (error) {
      // Return null if we don't want to force a default folder
      return null;
    }
  }

  // Move file to folder
  static async moveFileToFolder(fileId: string, folderId: string | null, userId: string): Promise<void> {
    const { error } = await supabase
      .from('files')
      .update({ folder_id: folderId })
      .eq('id', fileId)
      .eq('user_id', userId);
    
    if (error) throw error;
  }
}