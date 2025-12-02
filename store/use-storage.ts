import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface StorageState {
  bucketInfo: {
    name: string;
    isPublic: boolean;
    allowedMimeTypes: string[] | null;
  } | null;
  isLoading: boolean;
  error: Error | null;
  checkBucketAccess: (bucketName: string) => Promise<boolean>;
}

export const useStorage = create<StorageState>((set, get) => ({
  bucketInfo: null,
  isLoading: false,
  error: null,

  checkBucketAccess: async (bucketName: string) => {
    console.log('🔍 Checking bucket access:', bucketName);
    set({ isLoading: true, error: null });

    try {
      // First check if bucket exists
      const { data: buckets, error: listError } = await supabase
        .storage
        .listBuckets();

      if (listError) {
        console.error('❌ Error listing buckets:', listError);
        throw listError;
      }

      console.log('📦 Available buckets:',buckets,  buckets.map(b => ({ 
        name: b.name, 
        public: b.public,
        createdAt: b.created_at 
      })));

      const bucketExists = buckets.some(b => b.name === bucketName);
      if (!bucketExists) {
        console.error(`❌ Bucket '${bucketName}' not found`);
        throw new Error(`Storage bucket '${bucketName}' not found`);
      }

      // Test bucket access
      const { data: bucketInfo, error: bucketError } = await supabase
        .storage
        .getBucket(bucketName);

      if (bucketError) {
        console.error('❌ Error accessing bucket:', bucketError);
        throw bucketError;
      }

      console.log('✅ Bucket access verified:', {
        name: bucketInfo.name,
        public: bucketInfo.public,
        allowedMimeTypes: bucketInfo.allowed_mime_types
      });

      set({ 
        bucketInfo: {
          name: bucketInfo.name,
          isPublic: bucketInfo.public,
          allowedMimeTypes: bucketInfo.allowed_mime_types || null
        },
        isLoading: false 
      });

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to check bucket access');
      console.error('❌ Bucket access check failed:', err);
      set({ error: err, isLoading: false });
      return false;
    }
  }
}));
