'use server';

/**
 * Server action to enhance AI agent prompts using Google Gemini API
 * Matches the working implementation from smart-column/analyze/route.ts
 */

export async function enhancePromptWithAI(
    description: string,
    templateName: string,
    strategy: string
): Promise<{ success: boolean; enhancedPrompt?: string; error?: string }> {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        // Google AI Studio endpoint - using /v1/models/ with API key in query string
        // Model: gemini-1.5-flash (no -latest suffix for /v1/ endpoint)
        console.log("HELLLLLOOOO",apiKey);
        const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        // Create the prompt for Gemini
        const systemPrompt = `You are an expert at creating system prompts for AI voice agents. 
Given a user's description, create a detailed, professional system prompt for a ${templateName} AI agent helping with ${strategy}.

The system prompt should:
- Define the agent's role and personality clearly
- Include specific responsibilities and capabilities
- Set the tone (professional, empathetic, efficient as appropriate)
- Include conversation guidelines
- Be concise but comprehensive (200-400 words)

User's description: ${description}

Generate ONLY the system prompt, without any additional explanation or formatting.`;

        // Make the API request
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: systemPrompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google AI API error:', errorText);
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Extract the generated text
        const enhancedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!enhancedPrompt) {
            throw new Error('No response generated from AI');
        }

        return {
            success: true,
            enhancedPrompt: enhancedPrompt.trim(),
        };
    } catch (error) {
        console.error('Error enhancing prompt:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to enhance prompt',
        };
    }
}
