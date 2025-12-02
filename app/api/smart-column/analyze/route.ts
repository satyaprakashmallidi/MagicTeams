import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ColumnMetadata } from '@/components/smart-column-generator/types';

interface AnalyzeRequestBody {
  prompt: string;
  columnMetadata: ColumnMetadata[];
  apiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await request.json();
    const { prompt, columnMetadata, apiKey } = body;

    if (!prompt || !columnMetadata) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt or columnMetadata' },
        { status: 400 }
      );
    }

    console.log('Received analyze request with prompt:', prompt);
    console.log('Column metadata count:', columnMetadata.length);

    let requiredColumns: string[];

    if (apiKey) {
      try {
        requiredColumns = await analyzeWithGemini(prompt, columnMetadata, apiKey);
        console.log('Gemini analysis complete:', requiredColumns);
      } catch (error) {
        console.error('Error calling Gemini API for column analysis:', error);
        // Fall back to mock analysis if Gemini API fails
        console.log('Falling back to mock column analysis');
        requiredColumns = mockAnalyzeColumns(prompt, columnMetadata);
      }
    } else {
      // Use mock analysis if no API key provided
      console.log('No API key provided, using mock column analysis');
      requiredColumns = mockAnalyzeColumns(prompt, columnMetadata);
    }

    return NextResponse.json({ requiredColumns });
  } catch (error) {
    console.error('Error in analyze API:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * Calls the Gemini API to analyze which columns are needed to fulfill the prompt
 */
async function analyzeWithGemini(
  prompt: string,
  columnMetadata: ColumnMetadata[],
  apiKey: string
): Promise<string[]> {
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  const completePrompt = `
You are analyzing a collection of call transcripts and related metadata to help extract specific information based on the user's request.

The user has requested: "${prompt}"

I'll provide metadata about the available data columns. Your task is to analyze this request and determine which columns would be necessary to fulfill it.

Available columns and their metadata:
${JSON.stringify(columnMetadata, null, 2)}

Please respond with a JSON array containing ONLY the names of the columns that would be needed to fulfill the user's request. Include only the necessary columns.

Example response format:
["transcript", "call_summary"]

Do not include any explanations or text outside of the JSON array.
`;

  try {
    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: completePrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API responded with status: ${response.status}`);
    }

    const geminiResponse = await response.json();
    
    // Extract the text part from Gemini response
    const content = geminiResponse.candidates?.[0]?.content;
    const text = content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No text found in Gemini response');
    }

    // Try to extract a JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*?\]/) || 
                      text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    
    if (!jsonMatch) {
      throw new Error('No JSON array found in Gemini response');
    }
    
    // Parse the JSON array
    const requiredColumns = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(requiredColumns)) {
      throw new Error('Gemini response is not a valid array');
    }
    
    return requiredColumns;
  } catch (error) {
    console.error('Error analyzing columns with Gemini:', error);
    throw error;
  }
}

/**
 * Fallback function to analyze columns without using Gemini API
 * Uses basic keyword matching to determine which columns might be needed
 */
function mockAnalyzeColumns(
  prompt: string,
  columnMetadata: ColumnMetadata[]
): string[] {
  const promptLower = prompt.toLowerCase();
  const requiredColumns: string[] = [];
  
  // Add transcript and summary columns if they exist, as they're likely needed for most analyses
  const transcriptCol = columnMetadata.find(col => 
    col.name.toLowerCase().includes('transcript') || 
    col.name.toLowerCase().includes('conversation')
  );
  
  if (transcriptCol) {
    requiredColumns.push(transcriptCol.name);
  }
  
  const summaryCol = columnMetadata.find(col => 
    col.name.toLowerCase().includes('summary')
  );
  
  if (summaryCol) {
    requiredColumns.push(summaryCol.name);
  }
  
  // Check for specific entities mentioned in the prompt
  if (promptLower.includes('name') || promptLower.includes('person') || 
      promptLower.includes('caller') || promptLower.includes('customer')) {
    
    // Look for name columns
    const nameColumns = columnMetadata.filter(col => 
      col.semanticType === 'name' || 
      col.name.toLowerCase().includes('name') ||
      col.name.toLowerCase().includes('caller') ||
      col.name.toLowerCase().includes('customer')
    );
    
    nameColumns.forEach(col => {
      if (!requiredColumns.includes(col.name)) {
        requiredColumns.push(col.name);
      }
    });
  }
  
  // Add any columns whose name is directly mentioned in the prompt
  columnMetadata.forEach(col => {
    if (promptLower.includes(col.name.toLowerCase()) && !requiredColumns.includes(col.name)) {
      requiredColumns.push(col.name);
    }
  });
  
  // If we still don't have any columns, add columns based on data type matching
  if (requiredColumns.length === 0) {
    if (promptLower.includes('date') || promptLower.includes('time') || promptLower.includes('when')) {
      const dateColumns = columnMetadata.filter(col => 
        col.dataType === 'date' || 
        col.name.toLowerCase().includes('date') || 
        col.name.toLowerCase().includes('time')
      );
      
      dateColumns.forEach(col => requiredColumns.push(col.name));
    }
    
    if (promptLower.includes('email')) {
      const emailColumns = columnMetadata.filter(col => col.semanticType === 'email');
      emailColumns.forEach(col => requiredColumns.push(col.name));
    }
  }
  
  // Ensure we have at least some columns if the above logic didn't find any
  if (requiredColumns.length === 0 && columnMetadata.length > 0) {
    // Add some reasonable default columns
    requiredColumns.push(columnMetadata[0].name);
    
    // If we have more than one column, add a second one
    if (columnMetadata.length > 1) {
      requiredColumns.push(columnMetadata[1].name);
    }
  }
  
  return requiredColumns;
} 