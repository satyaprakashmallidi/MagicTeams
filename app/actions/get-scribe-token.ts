"use server";

export async function getScribeToken() {
    const response = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text/get-realtime-token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": process.env.ELEVENLABS_API_KEY!,
            },
            body: JSON.stringify({
                model_id: "scribe_v2_realtime",
                ttl_secs: 300,
            }),
        }
    );
    const data = await response.json();
    return data.token;
}
