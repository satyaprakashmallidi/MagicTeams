/**
 * Voice API Service
 * Fetches available voices from the Worker Backend
 */

import { getEnvVars } from "../env/getEnvVars";

const env = getEnvVars();

export interface VoiceResponse {
    voiceId: string;
    name: string;
    previewUrl: string;
}

export interface VoicesAPIResponse {
    status: string;
    data: VoiceResponse[];
}

class VoiceService {
    private baseURL: string;

    constructor() {
        this.baseURL = env.NEXT_PUBLIC_BACKEND_URL_WORKER || "";
    }

    /**
     * Gets all available voices from the backend
     * GET /api/voices
     */
    async getVoices(): Promise<VoiceResponse[]> {
        const endpoint = `${this.baseURL}/api/voices`;

        try {
            const response = await fetch(endpoint, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.statusText}`);
            }

            const data: VoicesAPIResponse = await response.json();

            if (data.status !== "success") {
                throw new Error("Failed to fetch voices");
            }

            return data.data;
        } catch (error) {
            console.error("Error fetching voices:", error);
            throw error;
        }
    }
}

// Export singleton instance
export const voiceService = new VoiceService();
export default voiceService;
