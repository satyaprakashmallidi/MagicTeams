'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ColumnTransformation } from '../types';

interface TransformationDetailsProps {
  transformation: ColumnTransformation;
  onClose: () => void;
}

export function TransformationDetails({ transformation, onClose }: TransformationDetailsProps) {
  const [showCode, setShowCode] = useState(false);
  
  // Check if this was generated using chunked direct processing (no real code)
  const isDirectProcessing = !transformation.code || transformation.code.startsWith('// Direct value generation');
  
  return (
    <Card className="p-4 max-w-2xl mx-auto my-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">Transformation Details</h3>
          <p className="text-sm text-gray-500">
            {isDirectProcessing 
              ? 'Created with chunked data processing' 
              : 'Created with code-based transformation'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-1">Prompt</h4>
          <p className="text-sm bg-gray-50 p-2 rounded">{transformation.prompt}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-1">Description</h4>
          <p className="text-sm bg-gray-50 p-2 rounded">{transformation.description}</p>
        </div>
        
        {transformation.sourceColumns && transformation.sourceColumns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Source Columns</h4>
            <div className="flex flex-wrap gap-1">
              {transformation.sourceColumns.map(col => (
                <span 
                  key={col} 
                  className="inline-block text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isDirectProcessing && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-sm font-medium">Generated Code</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowCode(!showCode)}
              >
                {showCode ? 'Hide Code' : 'Show Code'}
              </Button>
            </div>
            
            {showCode && (
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                <code>{transformation.code}</code>
              </pre>
            )}
          </div>
        )}
        
        {isDirectProcessing && (
          <div>
            <h4 className="text-sm font-medium mb-1">Process Information</h4>
            <p className="text-sm bg-gray-50 p-2 rounded">
              This column was created using direct data processing in chunks to handle the large dataset more efficiently. 
              Each chunk of data was processed separately and the results were combined.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
} 