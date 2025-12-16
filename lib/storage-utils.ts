import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET_NAME = 'FileStorage';
const FOLDER_NAME = 'KnowledgeBase';

async function uploadToStorage(file: File | Blob, filePath: string, contentType: string) {
  console.log('📤 Uploading to storage:', {
    bucket: BUCKET_NAME,
    filePath,
    contentType
  });

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      contentType,
      upsert: true
    });

  if (error) {
    console.error('❌ Storage upload error:', {
      name: error.name,
      message: error.message,
      status: error.status
    });
    throw error;
  }

  return data;
}

async function getPublicUrl(filePath: string) {
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!publicUrl) {
    throw new Error('Failed to generate public URL');
  }

  return publicUrl;
}

export async function deleteFileFromStorage(url: string) {
  try {
    // Extract the file path from the URL
    const urlParts = url.split('/public/FileStorage/');
    if (urlParts.length !== 2) {
      throw new Error('Invalid file URL format');
    }
    const filePath = urlParts[1];

    console.log('🗑️ Deleting file:', { filePath });

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('❌ Error deleting file:', error);
      throw error;
    }

    console.log('✅ File deleted successfully:', { filePath });
  } catch (error) {
    console.error('❌ Error in deleteFileFromStorage:', error);
    throw error;
  }
}

export async function uploadFileToStorage(file: File | Blob, fileName?: string) {
  console.log('📤 Starting file upload:', {
    type: file instanceof File ? 'File' : 'Blob',
    size: file.size,
    providedFileName: fileName
  });

  try {
    const actualFileName = fileName || (file instanceof File ? file.name : `${uuidv4()}.txt`);
    const fileExt = actualFileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${FOLDER_NAME}/${uniqueFileName}`;
    const contentType = file instanceof File ? file.type : 'text/plain';

    console.log('📁 Generated file path:', {
      actualFileName,
      uniqueFileName,
      filePath,
      bucket: BUCKET_NAME,
      contentType
    });

    await uploadToStorage(file, filePath, contentType);
    console.log('✅ File uploaded successfully:', { filePath });

    const publicUrl = await getPublicUrl(filePath);
    console.log('🔗 Generated public URL:', { publicUrl });

    const result = {
      url: publicUrl,
      fileName: actualFileName,
      type: contentType,
      size: file.size
    };

    console.log('📋 Upload result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in uploadFileToStorage:', error);
    throw error;
  }
}

export async function uploadTextToStorage(text: string, name: string) {
  console.log('📝 Starting text upload:', {
    textLength: text.length,
    name
  });

  try {
    const blob = new Blob([text], { type: 'text/plain' });
    console.log('📦 Created text blob:', {
      size: blob.size,
      type: blob.type
    });

    const result = await uploadFileToStorage(blob, name);
    console.log('✅ Text upload complete:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in uploadTextToStorage:', error);
    throw error;
  }
}

export async function listFilesFromStorage() {
  console.log('📂 Listing files from storage:', {
    bucket: BUCKET_NAME,
    folder: FOLDER_NAME
  });

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(FOLDER_NAME, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    console.error('❌ Error listing files:', error);
    throw error;
  }

  console.log(`✅ Found ${data.length} files`);

  // Generate public URLs for all files
  const filesWithUrls = await Promise.all(data.map(async (file) => {
    const filePath = `${FOLDER_NAME}/${file.name}`;
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return {
      name: file.name,
      id: file.id,
      updated_at: file.updated_at,
      created_at: file.created_at,
      last_accessed_at: file.last_accessed_at,
      metadata: file.metadata,
      url: publicUrl,
      size: file.metadata?.size || 0
    };
  }));

  return filesWithUrls;
}
