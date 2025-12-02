import { ColumnMetadata, DataGridItem, GeminiRequestBody, GeminiResponse } from '../types';

interface TransformRequestData {
  prompt: string;
  columnData: Record<string, any[]>;
  apiKey?: string;
}

interface TransformationResult {
  code: string;
  columnName: string;
  description: string;
  results: any[];
  reasoning: string;
}

/**
 * Analyzes column metadata to determine required columns based on the prompt
 */
export async function getRequiredColumnsForAnalysis(
  prompt: string,
  columnMetadata: ColumnMetadata[],
  apiKey?: string
): Promise<string[]> {
  if (apiKey) {
    try {
      const results = await analyzeWithGemini(prompt, columnMetadata, apiKey);
      return results;
    } catch (error) {
      console.error('Error analyzing with Gemini:', error);
      return mockAnalyzeColumns(prompt, columnMetadata);
    }
  }

  return mockAnalyzeColumns(prompt, columnMetadata);
}

/**
 * Calls the Gemini API to analyze column metadata
 */
async function analyzeWithGemini(
  prompt: string,
  columnMetadata: ColumnMetadata[],
  apiKey: string
): Promise<string[]> {
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  const completePrompt = `
You are a data analyst assistant. I need to determine which columns in my dataset are required for the following analysis:

User prompt: "${prompt}"

Available columns with metadata:
${JSON.stringify(columnMetadata, null, 2)}

Please analyze the user prompt and determine which columns from the dataset would be required to fulfill this request.
Return your response as a JSON array of column names, with no additional text or explanation.
Example: ["column1", "column2", "column3"]
`;

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
        maxOutputTokens: 1024,
        stopSequences: [],
        candidateCount: 1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API responded with status: ${response.status}`);
  }

  const geminiResponse = await response.json();
  const content = geminiResponse.candidates?.[0]?.content;
  const text = content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No text found in Gemini response');
  }

  // Extract JSON array from response
  const jsonMatch = text.match(/\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error('Failed to parse JSON from Gemini response');
    }
  }

  throw new Error('No valid column list found in Gemini response');
}

/**
 * Mocks column analysis when Gemini API is not available
 */
function mockAnalyzeColumns(
  prompt: string,
  columnMetadata: ColumnMetadata[]
): string[] {
  const promptLower = prompt.toLowerCase();
  const requiredColumns: string[] = [];

  // Extract all column names for easier pattern matching
  const allColumnNames = columnMetadata.map(col => col.name.toLowerCase());

  // Pattern match on the prompt to identify likely required columns
  columnMetadata.forEach(col => {
    const colNameLower = col.name.toLowerCase();

    // Direct mention of column name in prompt
    if (promptLower.includes(colNameLower) ||
      promptLower.includes(colNameLower.replace('_', ' '))) {
      requiredColumns.push(col.name);
    }

    // Look for semantic type matches
    if (col.semanticType) {
      const semanticTypeLower = col.semanticType.toLowerCase();

      if ((promptLower.includes('name') || promptLower.includes('person')) &&
        semanticTypeLower === 'name') {
        requiredColumns.push(col.name);
      }

      if ((promptLower.includes('email') || promptLower.includes('contact')) &&
        semanticTypeLower === 'email') {
        requiredColumns.push(col.name);
      }

      if ((promptLower.includes('phone') || promptLower.includes('contact') || promptLower.includes('call')) &&
        semanticTypeLower === 'phone') {
        requiredColumns.push(col.name);
      }

      if ((promptLower.includes('date') || promptLower.includes('time') || promptLower.includes('when')) &&
        (semanticTypeLower === 'date' || semanticTypeLower === 'datetime')) {
        requiredColumns.push(col.name);
      }

      if ((promptLower.includes('price') || promptLower.includes('cost') || promptLower.includes('amount')) &&
        semanticTypeLower === 'currency') {
        requiredColumns.push(col.name);
      }
    }
  });

  // Deduplicate columns
  return Array.from(new Set(requiredColumns));
}

/**
 * Generates column transformation based on prompt and column data
 */
export async function generateColumnTransformation(
  requestData: TransformRequestData
): Promise<TransformationResult> {
  const { prompt, columnData, apiKey } = requestData;

  console.log('\n=== COLUMN TRANSFORMATION REQUEST ===');
  console.log('Prompt:', prompt);
  console.log('Column Count:', Object.keys(columnData).length);
  console.log('API Key Present:', !!apiKey);

  if (apiKey) {
    try {
      console.log('Using Gemini API for transformation...');
      const result = await transformWithGemini(prompt, columnData, apiKey);
      return result;
    } catch (error) {
      console.error('❌ Gemini API error:', error);
      console.log('Falling back to mock implementation');
      return mockTransformColumns(prompt, columnData);
    }
  }

  console.log('Using mock implementation (no API key provided)');
  return mockTransformColumns(prompt, columnData);
}

/**
 * Calls the Gemini API to generate column transformation
 */
async function transformWithGemini(
  prompt: string,
  columnData: Record<string, any[]>,
  apiKey: string
): Promise<TransformationResult> {
  console.log('\n=== GEMINI API REQUEST ===');
  console.log('Prompt:', prompt);
  console.log('Columns:', Object.keys(columnData));
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 6)}...` : 'Not provided');

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  // Get column names and sample data
  const columnNames = Object.keys(columnData);
  const sampleSize = Math.min(3, columnData[columnNames[0]]?.length || 0);

  // Create sample data array of objects
  const sampleData = [];
  for (let i = 0; i < sampleSize; i++) {
    const row: Record<string, any> = {};
    for (const col of columnNames) {
      row[col] = columnData[col][i];
    }
    sampleData.push(row);
  }

  const completePrompt = `
You are a data transformation expert. I need to create a new column in a data grid with the following specifications:

User prompt: "${prompt}"

Available columns: ${JSON.stringify(columnNames)}

Sample data (first ${sampleSize} rows): 
${JSON.stringify(sampleData, null, 2)}

Please generate:
1. JavaScript code that can transform this data to create the new column
2. A suggested name for the new column
3. A brief description of what the transformation does
4. Example of the results for the sample data

The JavaScript code should be a function named executeTransformation that takes an array of objects (the data) and returns an array of values (the new column). Please ensure the code is correct and handles edge cases like null values.

Format your response as valid JSON with the following structure:
{
  "columnName": "string",
  "description": "string",
  "code": "string",
  "reasoning": "string explaining your thought process",
  "results": [sample results matching the length of the input sample]
}
`;

  console.log('Sending request to Gemini API...');

  try {
    const apiResponse = await fetch(geminiEndpoint, {
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
          maxOutputTokens: 2048,
          stopSequences: [],
          candidateCount: 1
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('❌ Gemini API Error:', apiResponse.status, errorText);
      throw new Error(`Gemini API responded with status: ${apiResponse.status}`);
    }

    console.log('✅ Received response from Gemini API');

    const geminiResponse = await apiResponse.json();
    const content = geminiResponse.candidates?.[0]?.content;
    const text = content?.parts?.[0]?.text;

    if (!text) {
      console.error('❌ No text found in Gemini response');
      throw new Error('No text found in Gemini response');
    }

    // Parse the JSON from the text response
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) ||
      text.match(/{[\s\S]*?"columnName"[\s\S]*?"description"[\s\S]*?"code"[\s\S]*?}/);

    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      console.log('Response text:', text.substring(0, 200) + '...');
      throw new Error('No JSON found in Gemini response');
    }

    const parsedResponse = JSON.parse(jsonMatch[1]);

    // Validate the response has required fields
    if (!parsedResponse.columnName || !parsedResponse.description || !parsedResponse.code) {
      console.error('❌ Parsed response missing required fields');
      throw new Error('Gemini response missing required fields');
    }

    console.log('\n=== GEMINI API RESPONSE ===');
    console.log('Column Name:', parsedResponse.columnName);
    console.log('Description:', parsedResponse.description);
    console.log('Code Length:', parsedResponse.code.length);

    // Apply the transformation to get actual results
    const results = evaluateTransformation(parsedResponse.code, sampleData);
    console.log('Sample Results:', results);

    const transformationResult: TransformationResult = {
      code: parsedResponse.code,
      columnName: parsedResponse.columnName,
      description: parsedResponse.description,
      results: parsedResponse.results || results,
      reasoning: parsedResponse.reasoning || 'Generated based on the provided prompt and column data.'
    };

    return transformationResult;
  } catch (error) {
    console.error('❌ Error in Gemini API call:', error);
    throw new Error(`Failed to process Gemini API response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Evaluates the transformation code to generate results
 */
function evaluateTransformation(code: string, sampleData: any[]): any[] {
  console.log('[evaluateTransformation] Starting with code length:', code.length);
  console.log('[evaluateTransformation] Sample data:', sampleData);

  try {
    // Create a new function from the code string
    console.log('[evaluateTransformation] Creating function from code');
    const transformFn = new Function('data', `
      ${code}
      return executeTransformation(data);
    `);

    // Execute the function with sample data
    console.log('[evaluateTransformation] Executing transformation function');
    const results = transformFn(sampleData);
    console.log('[evaluateTransformation] Results:', results);
    return results;
  } catch (error) {
    console.error('[evaluateTransformation] Error evaluating transformation code:', error);
    return [];
  }
}

/**
 * Generates mock transformation when Gemini API is not available
 */
function mockTransformColumns(
  prompt: string,
  columnData: Record<string, any[]>
): TransformationResult {
  console.log('[mockTransformColumns] Starting with prompt:', prompt);
  console.log('[mockTransformColumns] Column data keys:', Object.keys(columnData));

  const promptLower = prompt.toLowerCase();
  const columnNames = Object.keys(columnData);
  console.log('[mockTransformColumns] Column names:', columnNames);

  const sampleSize = Math.min(3, columnData[columnNames[0]]?.length || 0);
  console.log('[mockTransformColumns] Sample size:', sampleSize);

  // Create sample data array of objects
  const sampleData = [];
  for (let i = 0; i < sampleSize; i++) {
    const row: Record<string, any> = {};
    for (const col of columnNames) {
      row[col] = columnData[col][i];
    }
    sampleData.push(row);
  }
  console.log('[mockTransformColumns] Sample data:', sampleData);

  let transformationCode = '';
  let results: any[] = [];
  let columnName = '';
  let description = '';

  // Case 1: Concatenation of name columns
  if (promptLower.includes('full name') || (promptLower.includes('concaten') && promptLower.includes('name'))) {
    console.log('[mockTransformColumns] Detected name concatenation case');
    const firstNameCol = columnNames.find(col => col.toLowerCase().includes('first')) || '';
    const lastNameCol = columnNames.find(col => col.toLowerCase().includes('last')) || '';
    console.log('[mockTransformColumns] Found columns:', { firstNameCol, lastNameCol });

    if (firstNameCol && lastNameCol) {
      transformationCode = `
function executeTransformation(data) {
  return data.map(row => {
    const firstName = row["${firstNameCol}"] || "";
    const lastName = row["${lastNameCol}"] || "";
    return firstName && lastName ? \`\${firstName} \${lastName}\` : firstName || lastName || "";
  });
}`;

      results = sampleData.map(row => {
        const firstName = row[firstNameCol] || "";
        const lastName = row[lastNameCol] || "";
        return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || "";
      });

      console.log('[mockTransformColumns] Returning name concatenation result');
      return {
        code: transformationCode,
        columnName: `${firstNameCol}_${lastNameCol}_Combined`,
        description: `Combined ${firstNameCol} and ${lastNameCol} to create full names.`,
        results,
        reasoning: `Combined ${firstNameCol} and ${lastNameCol} to create full names.`
      };
    }
  }

  // Case 2: Extract domain from email
  if (promptLower.includes('domain') && promptLower.includes('email')) {
    console.log('[mockTransformColumns] Detected email domain extraction case');
    const emailCol = columnNames.find(col => col.toLowerCase().includes('email')) || '';
    console.log('[mockTransformColumns] Found email column:', emailCol);

    if (emailCol) {
      transformationCode = `
function executeTransformation(data) {
  return data.map(row => {
    const email = row["${emailCol}"] || "";
    const match = email.match(/@([^@]+)$/);
    return match ? match[1] : "";
  });
}`;

      results = sampleData.map(row => {
        const email = row[emailCol] || "";
        const match = email.match(/@([^@]+)$/);
        return match ? match[1] : "";
      });

      console.log('[mockTransformColumns] Returning email domain extraction result');
      return {
        code: transformationCode,
        columnName: `${emailCol}_Domain`,
        description: `Domain extracted from ${emailCol} column.`,
        results,
        reasoning: `Extracted domain part from ${emailCol} column.`
      };
    }
  }

  // Default case: Simple transformation on first column
  console.log('[mockTransformColumns] Using default transformation case');
  const firstCol = columnNames[0] || '';
  console.log('[mockTransformColumns] Using first column:', firstCol);

  if (firstCol) {
    transformationCode = `
function executeTransformation(data) {
  return data.map(row => {
    const value = row["${firstCol}"] || "";
    if (typeof value === 'number') {
      return value * 2; // Double numbers
    } else if (typeof value === 'string') {
      return value.toUpperCase(); // Uppercase strings
    }
    return String(value);
  });
}`;

    results = sampleData.map(row => {
      const value = row[firstCol] || "";
      if (typeof value === 'number') {
        return value * 2;
      } else if (typeof value === 'string') {
        return value.toUpperCase();
      }
      return String(value);
    });
  }

  console.log('[mockTransformColumns] Returning default transformation result');
  return {
    code: transformationCode,
    columnName: `Transformed_${firstCol}`,
    description: `Transformed ${firstCol} based on data type.`,
    results,
    reasoning: `Applied a default transformation to ${firstCol} based on data type.`
  };
}

/**
 * Execute the transformation code on the provided data
 */
export async function executeTransformation(
  code: string,
  data: DataGridItem[]
): Promise<any[]> {
  console.log('\n=== EXECUTING TRANSFORMATION ===');
  console.log('Code length:', code.length);
  console.log('Data rows:', data.length);

  try {
    // Create a function from the code string
    console.log('Creating execution function...');
    // eslint-disable-next-line no-new-func
    const transformFunction = new Function('data', `
      ${code}
      return executeTransformation(data);
    `);

    // Execute the function with the data
    console.log('Executing transformation...');
    const results = transformFunction(data);
    console.log('✅ Transformation successful:', {
      resultLength: results.length,
      sampleResults: results.slice(0, 3)
    });
    return results;
  } catch (error) {
    console.error('❌ Error executing transformation:', error);
    throw new Error(`Failed to execute transformation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Processes data in chunks to avoid overloading the Gemini API
 * This function breaks down the data into smaller chunks, processes each chunk,
 * and then combines the results.
 */
export async function processDataInChunks(
  prompt: string,
  data: DataGridItem[],
  apiKey?: string,
  chunkSize: number = 5
): Promise<{
  columnName: string;
  values: any[];
  description: string;
}> {
  console.log('\n=== CHUNK PROCESSING REQUEST ===');
  console.log('Prompt:', prompt);
  console.log('Total rows:', data.length);
  console.log('Chunk size:', chunkSize);
  console.log('API Key present:', !!apiKey);

  if (!apiKey) {
    throw new Error('API key is required for chunk processing');
  }

  if (data.length === 0) {
    throw new Error('No data to process');
  }

  // Get column names from the first data item
  const columns = Object.keys(data[0]);
  console.log('Available columns:', columns);

  // Calculate the number of chunks
  const numChunks = Math.ceil(data.length / chunkSize);
  console.log(`Processing data in ${numChunks} chunks...`);

  // Create chunks of data
  const chunks: DataGridItem[][] = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    chunks.push(data.slice(start, end));
  }

  let columnName = '';
  let description = '';
  const allResults: any[] = [];

  // Process each chunk with retry logic
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
    
    const chunk = chunks[i];
    let retries = 3; // Number of retries
    let success = false;
    
    while (retries > 0 && !success) {
      try {
        const chunkResult = await processChunkWithGemini(prompt, chunk, apiKey, i, columnName);
        
        // Use the first chunk's column name and description if they're not set yet
        if (i === 0 || !columnName) {
          columnName = chunkResult.columnName;
          description = chunkResult.description;
        }
        
        // Validate that all results are primitives before adding
        const validatedResults = chunkResult.results.map(item => {
          // Already handled in processChunkWithGemini but adding extra layer of protection
          if (item === null || item === undefined) return '';
          if (typeof item === 'object') return JSON.stringify(item);
          return item;
        });
        
        // Add the results to our collection
        allResults.push(...validatedResults);
        success = true;
        
        // Add a small delay between requests to avoid rate limiting
        if (i < chunks.length - 1) {
          console.log('Waiting before processing next chunk...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        retries--;
        console.error(`Error processing chunk ${i + 1}, retries left: ${retries}`, error);
        
        if (retries === 0) {
          throw new Error(`Failed to process chunk ${i + 1} after multiple attempts: ${error}`);
        }
        
        // Wait longer between retries
        console.log(`Waiting before retry... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Verify one last time that all results are primitive values
  for (let i = 0; i < allResults.length; i++) {
    if (typeof allResults[i] === 'object' && allResults[i] !== null) {
      console.warn(`Converting object result at index ${i} to string:`, allResults[i]);
      allResults[i] = JSON.stringify(allResults[i]);
    }
  }

  console.log(`✅ All ${chunks.length} chunks processed successfully`);
  console.log('Column name:', columnName);
  console.log('Total results:', allResults.length);

  return {
    columnName,
    values: allResults,
    description
  };
}

/**
 * Processes a single chunk of data with the Gemini API
 */
async function processChunkWithGemini(
  prompt: string,
  chunk: DataGridItem[],
  apiKey: string,
  chunkIndex: number,
  existingColumnName: string = ''
): Promise<{
  columnName: string;
  description: string;
  results: any[];
}> {
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  // Format the chunk data for easier processing by the model
  const columnNames = Object.keys(chunk[0]);
  const formattedData = chunk.map(row => {
    const formattedRow: Record<string, any> = {};
    for (const col of columnNames) {
      formattedRow[col] = row[col];
    }
    return formattedRow;
  });

  const completePrompt = `
You are a data transformation assistant. I need you to process this data according to the following instruction:

User prompt: "${prompt}"

This is chunk #${chunkIndex + 1} of the data. Please analyze this chunk and generate the requested outputs.

Data to process (${chunk.length} rows): 
${JSON.stringify(formattedData, null, 2)}

${existingColumnName ? `The column name for this data has already been decided as: "${existingColumnName}". Please use this name.` : 'Please suggest an appropriate name for the new column based on the prompt.'}

Please respond with:
1. The name for the new column ${existingColumnName ? '(use the provided name)' : '(make it concise and descriptive)'}
2. A brief description of what the transformation does (1-2 sentences)
3. The transformed values for each row in the data

IMPORTANT: The transformed values MUST be primitive types (strings, numbers, booleans), not objects or arrays. If you need to return complex information, convert it to a formatted string.

Format your response as valid JSON with the following structure:
{
  "columnName": "string",
  "description": "string", 
  "results": [array of primitive values (strings, numbers, booleans) matching the length of the input data]
}

Keep your response focused on just generating the transformation results without additional explanation.
`;

  console.log(`Sending chunk ${chunkIndex + 1} to Gemini API...`);
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
        maxOutputTokens: 8192,
        stopSequences: [],
        candidateCount: 1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API responded with status: ${response.status}`);
  }

  const geminiResponse = await response.json();
  const content = geminiResponse.candidates?.[0]?.content;
  const text = content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No text found in Gemini response');
  }

  // Extract JSON from response
  try {
    // Look for JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);
    
    // Validate the response has the expected structure
    if (!parsedResponse.columnName || !Array.isArray(parsedResponse.results)) {
      throw new Error('Invalid response structure: missing columnName or results');
    }
    
    // Ensure all results are primitive values
    const normalizedResults = parsedResponse.results.map((result: any) => {
      if (result === null || result === undefined) {
        return '';
      }
      
      // If result is an object or array, convert to JSON string
      if (typeof result === 'object') {
        console.warn('Converting object result to string:', result);
        return JSON.stringify(result);
      }
      
      // Otherwise return the primitive value
      return result;
    });
    
    // Verify results array length matches input data
    if (normalizedResults.length !== chunk.length) {
      console.warn(`Warning: Results length (${normalizedResults.length}) does not match chunk length (${chunk.length})`);
      // Padding or truncating the results to match input length
      if (normalizedResults.length < chunk.length) {
        parsedResponse.results = [...normalizedResults, ...Array(chunk.length - normalizedResults.length).fill('')];
      } else {
        parsedResponse.results = normalizedResults.slice(0, chunk.length);
      }
    } else {
      parsedResponse.results = normalizedResults;
    }
    
    return {
      columnName: parsedResponse.columnName,
      description: parsedResponse.description || 'Transformation based on provided prompt',
      results: parsedResponse.results
    };
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    console.error('Raw response text:', text);
    throw new Error(`Failed to process Gemini API response: ${error}`);
  }
} 