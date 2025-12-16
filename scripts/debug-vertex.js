const https = require('https');

const API_KEY = "AQ.Ab8RN6JCdtKHYmhEjHDy7xIrQJUKOSNfz5VjRq5x8Wba_JyPAQ";
const PROJECT = "peppy-citron-480805-h9";
const LOCATION = "us-central1";
const MODEL = "gemini-live-2.5-flash-preview-native-audio-09-2025";

async function testEndpoint(name, url, isStream = false) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);
    
    const systemPrompt = "Say hello.";
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-user-project': PROJECT
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
                generationConfig: { maxOutputTokens: 10 }
            }),
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.log(`Error Body: ${text}`);
        } else {
            console.log("SUCCESS!");
            if (!isStream) {
                const data = await response.json();
                console.log("Response:", JSON.stringify(data, null, 2));
            } else {
                console.log("(Stream response received)");
            }
        }
    } catch (e) {
        console.log(`Exception: ${e.message}`);
    }
}

async function runTests() {
    // Test 1: generateContent (Standard Vertex)
    await testEndpoint(
        "Vertex generateContent",
        `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent?key=${API_KEY}`
    );

    // Test 2: streamGenerateContent (User mentioned this)
    await testEndpoint(
        "Vertex streamGenerateContent",
        `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:streamGenerateContent?key=${API_KEY}`,
        true
    );

    // Test 3: Global Endpoint (Maybe?)
    await testEndpoint(
        "Global AI Platform",
        `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent?key=${API_KEY}`
    );
    
    // Test 4: Generative Language (AI Studio style - unlikely to work with Vertex key but worth a shot)
    await testEndpoint(
        "Generative Language API",
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`
    );
}

runTests();
