const fs = require('fs');
const path = require('path');

const API_KEY = "AQ.Ab8RN6KCEoHUjUw6SAH9Eo8L9bwO8ozweSE8Cf0ivmyEcPMuDw";
const API_URL = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:streamGenerateContent?key=${API_KEY}`;

async function testGeminiLite() {
    const logFile = path.join(__dirname, '..', 'debug-gemini.txt');
    const log = (msg) => {
        console.log(msg);
        try {
            fs.appendFileSync(logFile, msg + '\n');
        } catch (e) {
            console.error('Error writing to log file:', e);
        }
    };

    // Clear previous log
    try {
        fs.writeFileSync(logFile, '');
    } catch (e) {
        console.error('Error clearing log file:', e);
    }

    log('Testing Gemini 2.5 Flash Lite with fetch...');

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: "Explain how AI works in a few words"
                    }
                ]
            }
        ]
    };

    try {
        log(`Sending request to ${API_URL}`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        log('Response Data: ' + JSON.stringify(data, null, 2));
        
        // Check for content
        let enhancedPrompt = '';
        if (Array.isArray(data)) {
            for (const chunk of data) {
                if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                    enhancedPrompt += chunk.candidates[0].content.parts[0].text;
                }
            }
        } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            enhancedPrompt = data.candidates[0].content.parts[0].text;
        }
        
        log('Extracted Text: ' + enhancedPrompt);

    } catch (error) {
        log('FAILED: ' + error.message);
        if (error.cause) {
            log('Cause: ' + error.cause);
        }
    }
}

testGeminiLite();
