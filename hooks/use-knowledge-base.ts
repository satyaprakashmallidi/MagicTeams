import { useState, useEffect } from 'react';
import { KnowledgeBase, CreateKnowledgeBaseRequest } from '@/types/knowledge-base';
import { useUser } from './use-user';
import { createKnowledgeBase as createKB, updateKnowledgeBase as updateKB, deleteKnowledgeBase as deleteKB, getKnowledgeBases as getKBs, getKnowledgeBaseById as getKBById } from '@/lib/knowledge-base-api';

export function useKnowledgeBase() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const { user } = useUser();

  const createKnowledgeBase = async (knowledgeBase: CreateKnowledgeBaseRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🆕 Creating new knowledge base...');
      await createKB(knowledgeBase);
      console.log('✅ Knowledge base created successfully');
      
      // Create a mock knowledge base object since the API doesn't return one
      const mockKnowledgeBase: KnowledgeBase = {
        corpus_id: `temp-${Date.now()}`, // This will be replaced when we fetch the real data
        name: knowledgeBase.name || '',
        description: knowledgeBase.description || '',
        user_id: user?.id || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        knowledgebase_sources: [{
          source_id: '',
          corpus_id: `temp-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source_urls: knowledgeBase.urls || []
        }]
      };
      
      // Add the mock knowledge base to our state
      setKnowledgeBases(prevState => [...prevState, mockKnowledgeBase]);
      
      return mockKnowledgeBase;
    } catch (err) {
      console.error('❌ Failed to create knowledge base:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKnowledgeBases = async () => {
    if (!user?.id) {
      console.log('⚠️ Cannot fetch knowledge bases: No user ID');
      return;
    }
    
    console.log('🔍 API Call: Fetching all knowledge bases for user:', user.id);
    setIsLoading(true);
    setError(null);

    try {
      const result = await getKBs(user.id);
      console.log(`✅ API Response: ${result.length} knowledge bases fetched`);
      
      if (result.length > 0) {
        console.log('📊 First knowledge base:', {
          id: result[0].corpus_id,
          name: result[0].name
        });
      }
      
      setKnowledgeBases(result);
      return result;
    } catch (err) {
      console.error('❌ Failed to fetch knowledge bases:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, [user?.id]);

  const getKnowledgeBaseById = async (id: string) => {
    if (!user?.id) {
      console.log('⚠️ Cannot fetch knowledge base details: No user ID');
      return null;
    }
    
    console.log(`🔍 API Call: Fetching knowledge base details for ID: ${id}`);
    setIsLoading(true);
    setError(null);

    try {
      const result = await getKBById(id, user.id);
      
      console.log('📚 Knowledge base data from API:', result);
      
      // If there's no corpus_details in the response, add a default one
      if (result && !result.corpus_details) {
        console.log('⚠️ API response missing corpus_details, adding default values');
        result.corpus_details = {
          corpusId: result.corpus_id,
          created: result.created_at,
          name: result.name,
          description: result.description || '',
          stats: {
            status: 'CORPUS_STATUS_INITIALIZING',
            lastUpdated: new Date().toISOString(),
            numDocs: result.knowledgebase_sources?.[0]?.source_urls?.length || 0,
            numChunks: 0,
            numVectors: 0
          }
        };
      }
      
      console.log('✅ API Response: Knowledge base details fetched:', {
        id: result?.corpus_id,
        name: result?.name,
        hasCorpusDetails: !!result?.corpus_details,
        status: result?.corpus_details?.stats?.status
      });
      return result;
    } catch (err) {
      console.error(`❌ Failed to fetch knowledge base ${id}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateKnowledgeBase = async (id: string, knowledgeBase: Partial<KnowledgeBase>) => {
    console.log('🔄 API Call: Updating knowledge base:', id);
    setIsLoading(true);
    setError(null);

    try {
      // First, make the API call to update the knowledge base
      await updateKB(id, knowledgeBase);
      console.log('✅ API Response: Knowledge base updated successfully');
      
      // Try to find the existing knowledge base in our state
      let existingKB = knowledgeBases.find(kb => kb.corpus_id === id);
      
      // If the knowledge base isn't in our state, try to fetch it first
      if (!existingKB && user?.id) {
        console.log('⚠️ Knowledge base not found in state, fetching it first:', id);
        try {
          const result = await getKBById(id, user.id);
          // Make sure we have a valid result before using it
          if (result && typeof result === 'object' && 'corpus_id' in result) {
            console.log('✅ Successfully fetched knowledge base for update:', id);
            existingKB = result;
            
            // Add the newly fetched knowledge base to our state
            setKnowledgeBases(prevState => {
              const updatedState = [...prevState];
              if (!updatedState.some(kb => kb.corpus_id === id)) {
                updatedState.push(result);
              }
              return updatedState;
            });
          }
        } catch (fetchError) {
          console.error('❌ Failed to fetch knowledge base for update:', fetchError);
        }
      }
      
      // If we still don't have the knowledge base, create a minimal object
      if (!existingKB) {
        console.log('⚠️ Creating minimal knowledge base object for update');
        existingKB = {
          corpus_id: id,
          name: knowledgeBase.name || 'Unknown',
          description: knowledgeBase.description || '',
          user_id: user?.id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          knowledgebase_sources: [{
            source_id: '',
            corpus_id: id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source_urls: knowledgeBase.urls || []
          }]
        };
      }
      
      // Create the updated knowledge base object
      const updatedKB: KnowledgeBase = {
        ...existingKB,
        ...knowledgeBase,
        corpus_id: id,
        updated_at: new Date().toISOString(),
        knowledgebase_sources: existingKB.knowledgebase_sources?.map(source => ({
          ...source,
          source_urls: knowledgeBase.urls || source.source_urls
        }))
      };
      
      // Update our state with the new knowledge base
      setKnowledgeBases(prevState => {
        const updatedState = [...prevState];
        const index = updatedState.findIndex(kb => kb.corpus_id === id);
        
        if (index !== -1) {
          // Update existing knowledge base
          updatedState[index] = updatedKB;
        } else {
          // Add new knowledge base
          updatedState.push(updatedKB);
        }
        
        return updatedState;
      });
      
      return updatedKB;
    } catch (err) {
      console.error(`❌ Failed to update knowledge base ${id}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteKnowledgeBase = async (id: string) => {
    if (!user?.id) {
      console.log('⚠️ Cannot delete knowledge base: No user ID');
      throw new Error('User ID is required to delete a knowledge base');
    }
    
    console.log(`🗑️ API Call: Deleting knowledge base: ${id}`);
    setIsLoading(true);
    setError(null);

    try {
      await deleteKB(id, user.id);
      console.log('✅ API Response: Knowledge base deleted successfully:', id);
      
      // Update local state to remove the deleted knowledge base
      setKnowledgeBases(prev => prev.filter(kb => kb.corpus_id !== id));
      return true;
    } catch (err) {
      console.error(`❌ Failed to delete knowledge base ${id}:`, err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    knowledgeBases,
    createKnowledgeBase,
    fetchKnowledgeBases,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    getKnowledgeBaseById,
  };
}
