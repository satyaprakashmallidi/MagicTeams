export interface KnowledgeBase {
  corpus_id: string;
  name: string;
  description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  knowledgebase_sources: {
    source_id: string;
    corpus_id: string;
    created_at: string;
    updated_at: string;
    source_urls: string[];
  }[];
  ultravox_details?: {
    corpusId: string;
    created: string;
    name: string;
    stats: {
      numDocs: number;
      numChunks: number;
      numVectors: number;
      status: string;
      lastUpdated: string;
    };
  };
  corpus_details?: {
    corpusId: string;
    created: string;
    name: string;
    description: string;
    stats: {
      status: string;
      lastUpdated: string;
      numDocs: number;
      numChunks?: number;
      numVectors?: number;
    };
  };
  urls?: string[];
}

export interface DocumentSource {
  type: 'url' | 'text' | 'file';
  name: string;
  url: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description: string;
  userId?: string;
  urls: string[];
}

export interface KnowledgeBaseResponse {
  status: 'success' | 'error';
  data?: KnowledgeBase[];
  message?: string;
}
