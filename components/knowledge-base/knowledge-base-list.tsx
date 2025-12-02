'use client';

import { useEffect } from 'react';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/hooks/use-user';
import { Skeleton } from '@/components/ui/skeleton';

interface KnowledgeBaseListProps {
  onSelectBase: (baseId: string) => void;
  selectedBaseId: string | null;
}

export function KnowledgeBaseList({ onSelectBase, selectedBaseId }: KnowledgeBaseListProps) {
  const { user } = useUser();
  const { bases, isLoading, error, fetchKnowledgeBases } = useKnowledgeBase();

  useEffect(() => {
    if (user?.id) {
      fetchKnowledgeBases(user.id);
    }
  }, [user?.id, fetchKnowledgeBases]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bases.map((base) => (
        <div
          key={base.corpus_id}
          onClick={() => onSelectBase(base.corpus_id)}
          className={`group relative p-4 rounded-xl border border-gray-200 transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer ${
            selectedBaseId === base.corpus_id ? 'bg-gray-50 border-gray-300 shadow-sm' : 'bg-white'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedBaseId === base.corpus_id ? 'bg-primary/10' : 'bg-gray-100'
              }`}>
                <Icon name="book-open" className={`h-5 w-5 ${
                  selectedBaseId === base.corpus_id ? 'text-primary' : 'text-gray-600'
                }`} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {base.name}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                {base.description || 'No description'}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  base.knowledgebase_sources[0]?.status === 'ready' 
                    ? 'bg-green-100 text-green-700'
                    : base.knowledgebase_sources[0]?.status === 'processing'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {base.knowledgebase_sources[0]?.status}
                </span>
                <span className="text-xs text-gray-500">
                  {base.knowledgebase_sources[0]?.totalDocuments} documents
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
