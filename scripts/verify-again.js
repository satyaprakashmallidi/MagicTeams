const https = require('https');

// Reading from .env.local manually to ensure we use the exact same key as the app
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GOOGLE_VERTEX_API_KEY=(.*)/);
    if (match && match[1]) apiKey = match[1].trim();
} catch (e) {}

const PROJECT = "peppy-citron-480805-h9";
const LOCATION = "us-central1";
const MODEL = "gemini-live-2.5-flash-preview-native-audio-09-2025";

async function verify() {
    console.log("Verifying Vertex AI connection...");
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-user-project': PROJECT
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Test" }] }],
                generationConfig: { maxOutputTokens: 10 }
            }),
        });

        if (response.ok) {
            console.log("SUCCESS: Connection established.");
        } else {
            const text = await response.text();
            console.log(`FAILURE: ${response.status}`);
            console.log(text);
        }
    } catch (e) {
        console.log(`ERROR: ${e.message}`);
    }
}

verify();
