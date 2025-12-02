'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function StartPageSkeleton() {
  return (
    <div className="h-full flex">
      {/* Left Panel Skeleton */}
      <div className="w-[35%] border-r border-gray-200 flex flex-col">
        {/* Step 1 Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-40" />
          </div>

          {/* Campaign Name */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded" />
          </div>

          {/* File Selection */}
          <div className="space-y-2 mb-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded" />
          </div>

          {/* Continue Button */}
          <Skeleton className="h-10 w-24 rounded" />
        </div>

        {/* Step 2 Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-48" />
          </div>

          {/* Bot Selection */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded" />
          </div>

          {/* Phone Numbers */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-3/4 rounded" />
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3 mb-6">
            <Skeleton className="h-4 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded" />
            <Skeleton className="h-10 w-32 rounded" />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex-1 p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div className="w-1 bg-gray-200 cursor-col-resize hover:bg-gray-300 transition-colors"></div>

      {/* Right Panel Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Right Panel Header */}
        <div className="px-3 py-2 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-48 rounded" />
            </div>
          </div>
        </div>

        {/* Excel Toolbar Skeleton */}
        <div className="px-3 py-1.5 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-16 rounded" />
              <Skeleton className="h-7 w-16 rounded" />
            </div>
            <Skeleton className="h-4 w-px" />
            <Skeleton className="h-7 w-16 rounded" />
            <div className="flex items-center gap-1 ml-auto">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>

        {/* Enhanced Table Skeleton */}
        <div className="flex-1 overflow-hidden bg-white">
          <div className="h-full relative">
            {/* Realistic Table Structure */}
            <div className="border border-gray-200 rounded-sm m-2 h-[calc(100%-5rem)]">
              {/* Table Header */}
              <div className="bg-gray-50 border-b border-gray-300 sticky top-0">
                <div className="flex">
                  {/* Row number header */}
                  <div className="w-12 p-2 border-r border-gray-300 bg-gray-100 flex items-center justify-center">
                    <Skeleton className="h-3 w-3" />
                  </div>
                  {/* Checkbox header */}
                  <div className="w-12 p-2 border-r border-gray-300 bg-gray-100 flex items-center justify-center">
                    <Skeleton className="h-3 w-3 rounded-sm" />
                  </div>
                  {/* Column headers */}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex-1 min-w-[120px] p-2 border-r border-gray-300 bg-gray-100">
                      <Skeleton className="h-4 w-full max-w-[80px]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Body */}
              <div className="overflow-auto">
                {Array.from({ length: 10 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex border-b border-gray-200 hover:bg-gray-50">
                    {/* Row number */}
                    <div className="w-12 p-2 border-r border-gray-300 bg-gray-50 flex items-center justify-center">
                      <Skeleton className="h-3 w-4" />
                    </div>
                    {/* Checkbox */}
                    <div className="w-12 p-2 border-r border-gray-300 flex items-center justify-center">
                      <Skeleton className="h-3 w-3 rounded-sm" />
                    </div>
                    {/* Cell data */}
                    {Array.from({ length: 6 }).map((_, cellIndex) => (
                      <div key={cellIndex} className="flex-1 min-w-[120px] p-2 border-r border-gray-300">
                        <Skeleton className={`h-4 ${
                          cellIndex === 0 ? 'w-24' :
                          cellIndex === 1 ? 'w-16' :
                          cellIndex === 2 ? 'w-20' :
                          cellIndex === 3 ? 'w-12' :
                          cellIndex === 4 ? 'w-28' : 'w-14'
                        }`} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Enhanced Pagination */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}