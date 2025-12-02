'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { generateColumnTransformation } from '../services/gemini-service';
import { DataGridItem, ColumnMetadata } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';

interface ColumnPromptProps {
  data: DataGridItem[];
  columnMetadata?: ColumnMetadata[];
  geminiApiKey?: string;
  onGenerateColumn: (
    columnName: string, 
    values: any[], 
    code: string, 
    description: string,
    prompt: string,
    sourceColumns?: string[]
  ) => void;
  disabled?: boolean;
}

export function ColumnPrompt({ 
  data, 
  columnMetadata, 
  geminiApiKey,
  onGenerateColumn, 
  disabled = false 
}: ColumnPromptProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('\n=== GENERATE COLUMN REQUEST ===');
    console.log('Prompt:', prompt);
    
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt',
        variant: 'destructive',
      });
      return;
    }

    if (data.length === 0) {
      toast({
        title: 'Error',
        description: 'No data available to transform',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      console.log('API Key present:', !!geminiApiKey);
      
      // Get column names from the first data item for source column detection later
      const columns = Object.keys(data[0]);
      console.log('Available columns:', columns);
      
      // Use the chunk processing approach with better scalability
      console.log('Using chunked processing to handle large datasets...');
      const { processDataInChunks } = await import('../services/gemini-service');
      
      // Process data in chunks
      const result = await processDataInChunks(
        prompt,
        data,
        geminiApiKey,
        5 // Default chunk size of 5 rows
      );
      
      console.log('\n=== TRANSFORMATION CREATED ===');
      console.log('Column name:', result.columnName);
      console.log('Description:', result.description?.substring(0, 100) + '...');
      console.log('Generated values count:', result.values.length);
      
      // Determine source columns based on prompt and column names
      // Since we don't have code to analyze, we'll make an educated guess
      const promptLower = prompt.toLowerCase();
      const potentialSourceColumns = columns.filter(col => 
        promptLower.includes(col.toLowerCase()) || 
        promptLower.includes(col.toLowerCase().replace('_', ' '))
      );
      
      console.log('Potential source columns:', potentialSourceColumns);

      // Pass the results to the parent component
      console.log('Passing results to parent component...');
      onGenerateColumn(
        result.columnName,
        result.values,
        '', // No code in this approach since we're directly processing data
        result.description,
        prompt,
        potentialSourceColumns
      );

      // Clear the prompt
      setPrompt('');

      console.log('✅ Column generation complete');
      toast({
        title: 'Success',
        description: `Created column "${result.columnName}"`,
      });
    } catch (error) {
      console.error('❌ Error generating column:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate column',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate examples for prompts based on available columns
  const generateExamplePrompt = () => {
    if (!columnMetadata || columnMetadata.length === 0) return '';
    
    // Look for patterns in the metadata
    const emailCol = columnMetadata.find(col => col.semanticType === 'email')?.name;
    const nameCol = columnMetadata.find(col => col.semanticType === 'name')?.name;
    const firstNameCol = columnMetadata.find(col => col.name.toLowerCase().includes('first'))?.name;
    const lastNameCol = columnMetadata.find(col => col.name.toLowerCase().includes('last'))?.name;
    const phoneCol = columnMetadata.find(col => col.semanticType === 'phone')?.name;
    
    if (emailCol) {
      return `Extract the domain from the ${emailCol} column`;
    } else if (firstNameCol && lastNameCol) {
      return `Create a Full Name column by concatenating ${firstNameCol} and ${lastNameCol}`;
    } else if (nameCol) {
      return `Extract the initials from the ${nameCol} column`;
    } else if (phoneCol) {
      return `Format ${phoneCol} in international format`;
    } else if (columnMetadata.length >= 2) {
      // Default to combining two random columns
      const col1 = columnMetadata[0].name;
      const col2 = columnMetadata[1].name;
      return `Create a new column that combines ${col1} and ${col2}`;
    }
    
    return '';
  };

  const placeholderExample = generateExamplePrompt() || 
    'Create a Full Name column by concatenating First Name and Last Name';

  const examplePrompts = [
    placeholderExample,
    'Extract sentiment (positive/negative/neutral) from transcript',
    'Determine if the call was successful based on the transcript',
    'Create a category based on keywords in the transcript'
  ];

  return (
    <Card className="border border-gray-200">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <div className="relative">
              <Input 
                type="text"
                placeholder={`Enter a smart column prompt (e.g., '${placeholderExample}')`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={disabled || isGenerating}
                className="w-full pr-12 h-10 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-gray-500 italic pl-1">
              Use natural language to describe what data transformation you need
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-1">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPrompt(example)}
                  disabled={disabled || isGenerating}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-2 py-1 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
            
            <Button 
              type="submit" 
              disabled={disabled || isGenerating || !prompt.trim()}
              className="ml-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Column
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 