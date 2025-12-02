'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState() {
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-50 to-white">
      {/* Compact Header Skeleton */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="flex items-center space-x-1">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-6 w-12 rounded" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-6 w-12 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 overflow-hidden">
        {/* Section Header Skeleton */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-8 w-24 rounded" />
            </div>
          </div>
        </div>

        {/* Content Grid Skeleton */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="px-6 py-8">
            {/* Upload Area Skeleton */}
            <div className="mb-8">
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <Skeleton className="w-20 h-20 rounded-full mx-auto mb-6" />
                <Skeleton className="h-6 w-48 mx-auto mb-2" />
                <Skeleton className="h-4 w-64 mx-auto mb-6" />
                <Skeleton className="h-10 w-32 mx-auto rounded" />
              </div>
            </div>

            {/* Grid Items Skeleton */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton className="w-14 h-14 rounded-xl" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-5 w-32 mb-3" />
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <Skeleton className="h-4 w-8 mx-auto mb-1" />
                          <Skeleton className="h-3 w-6 mx-auto" />
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <Skeleton className="h-4 w-6 mx-auto mb-1" />
                          <Skeleton className="h-3 w-8 mx-auto" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}