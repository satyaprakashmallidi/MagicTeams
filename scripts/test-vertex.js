const fs = require('fs');
const path = require('path');
const https = require('https');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GOOGLE_VERTEX_API_KEY=(.*)/);
    if (match && match[1]) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.error('Error reading .env.local:', e.message);
    process.exit(1);
}

if (!apiKey) {
    console.error('GOOGLE_VERTEX_API_KEY not found in .env.local');
    process.exit(1);
}

async function testEnhancePrompt() {
    console.log('Testing Google Vertex AI integration...');
    console.log('API Key found (length):', apiKey.length);

    const project = "peppy-citron-480805-h9";
    const location = "us-central1";
    const model = "gemini-live-2.5-flash-preview-native-audio-09-2025";
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent?key=${apiKey}`;

    const description = "A helpful sales agent for a real estate company";
    const templateName = "Sales Agent";
    const strategy = "Real Estate";

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

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-user-project': project
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
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
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const enhancedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!enhancedPrompt) {
            throw new Error('No response generated from AI');
        }

        console.log('\nSUCCESS! Generated Prompt:\n');
        console.log(enhancedPrompt);
        console.log('\nIntegration verified.');

    } catch (error) {
        console.error('\nFAILED:', error.message);
    }
}

testEnhancePrompt();
