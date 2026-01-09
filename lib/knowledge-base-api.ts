import { CreateKnowledgeBaseRequest, KnowledgeBase, KnowledgeBaseResponse } from '@/types/knowledge-base';
import { getEnvVars } from './env/getEnvVars';
import { apiFetch } from './utils/api-fetch';

const API_BASE_URL = getEnvVars().NEXT_PUBLIC_BACKEND_URL_WORKER;

export async function createKnowledgeBase(request: CreateKnowledgeBaseRequest): Promise<void> {
  console.log('📝 Creating knowledge base:', request);

  if (!request.urls?.length) {
    throw new Error('At least one URL is required');
  }

  const response = await apiFetch(`${API_BASE_URL}/api/knowledgebase`, {
    method: 'POST',
    headers: {
      'X-User-ID': request.user_id || '',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to create knowledge base:', error);
    throw new Error(error.message || 'Failed to create knowledge base');
  }
}

export async function getKnowledgeBases(userId: string): Promise<KnowledgeBase[]> {
  console.log('🔍 Fetching knowledge bases for user:', userId);

  try {
    const response = await apiFetch(`${API_BASE_URL}/api/knowledgebase?userId=${userId}`);

    console.log('📥 Knowledge bases response:', response.status, response.statusText);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('ℹ️ No knowledge bases found');
        return [];
      }
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('❌ Failed to fetch knowledge bases:', error);
      throw new Error(error.message || `Failed to fetch knowledge bases: ${response.statusText}`);
    }

    const data: KnowledgeBaseResponse = await response.json();
    console.log('📚 Knowledge bases data:', data);

    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to fetch knowledge bases');
    }

    return data.data || [];
  } catch (error) {
    console.error('❌ Failed to fetch knowledge bases:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch knowledge bases');
  }
}

export async function updateKnowledgeBase(id: string, request: Partial<KnowledgeBase> & { urls?: string[] }): Promise<void> {
  console.log('✏️ Updating knowledge base:', id, request);

  const response = await apiFetch(`${API_BASE_URL}/api/knowledgebase/${id}`, {
    method: 'PATCH',
    headers: {
      'X-User-ID': request.user_id ?? '',
    },
    body: JSON.stringify({
      name: request.name,
      description: request.description,
      knowledgebase_sources: request.knowledgebase_sources,
      userId: request.user_id,
      urls: request.urls || [],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to update knowledge base:', error);
    throw new Error(error.message || 'Failed to update knowledge base');
  }
}

export async function deleteKnowledgeBase(id: string, userId: string): Promise<void> {
  console.log('🗑️ Deleting knowledge base:', id);

  const response = await apiFetch(`${API_BASE_URL}/api/knowledgebase/${id}?userId=${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to delete knowledge base:', error);
    throw new Error(error.message || 'Failed to delete knowledge base');
  }
}

export async function getKnowledgeBaseById(id: string, userId: string): Promise<KnowledgeBase | undefined> {
  console.log('� Fetching knowledge base by ID:', id);

  try {
    const response = await apiFetch(`${API_BASE_URL}/api/knowledgebase/${id}?userId=${userId}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Failed to fetch knowledge base by ID:', error);
      throw new Error(error.message || 'Failed to fetch knowledge base by ID');
    }

    const data = await response.json();
    console.log('�📚 Knowledge base data:', data);

    // Ensure data is structured correctly for our frontend
    if (data && typeof data === 'object') {
      // If it's missing corpus_details, we'll add it later in the hook
      return data as KnowledgeBase;
    } else {
      console.error('❌ Invalid knowledge base data structure:', data);
      throw new Error('Invalid knowledge base data returned from API');
    }
  } catch (error) {
    console.error('❌ Failed to fetch knowledge base by ID:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch knowledge base by ID');
  }
}