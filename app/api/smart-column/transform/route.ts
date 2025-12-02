import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequiredColumnsForAnalysis, generateColumnTransformation } from '@/components/smart-column-generator/services/gemini-service';

interface TransformRequestBody {
  prompt: string;
  columnData: Record<string, any[]>;
  apiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TransformRequestBody = await request.json();
    const { prompt, columnData, apiKey } = body;

    if (!prompt || !columnData) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt or columnData' },
        { status: 400 }
      );
    }

    console.log('Received transform request with prompt:', prompt);
    console.log('Column data received for columns:', Object.keys(columnData));

    try {
      const requestData = {
        prompt,
        columnData,
        apiKey
      };

      const transformationResult = await generateColumnTransformation(requestData);
      
      console.log('Transformation result received');
      
      return NextResponse.json({
        transformationCode: transformationResult.code,
        transformedData: transformationResult.results,
        reasoning: transformationResult.reasoning,
      });
    } catch (error) {
      console.error('Error calling Gemini API for transformation:', error);
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Error generating column transformation' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in transform API:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 