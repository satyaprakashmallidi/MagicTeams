/**
 * Agent API Service
 * Handles all interactions with the Worker Backend's Agent API endpoints
 */

import { getEnvVars } from "../env/getEnvVars";
import { logAPICall, logAgentSync, logBotOperation } from "../utils/api-logger";

const env = getEnvVars();

export interface CreateAgentRequest {
  user_id: string;
  name: string;
  voice_id: string;
  system_prompt: string;
  model?: string;
  temperature?: number;
  first_speaker?: "FIRST_SPEAKER_USER" | "FIRST_SPEAKER_AGENT";
  selected_tools?: string[];
  selected_webhooks?: string[];
  call_transfer_number?: string;
}

export interface UpdateAgentRequest {
  id: string;
  name?: string;
  twilio_from_number?: string;
  voice_id?: string;
  system_prompt?: string;
  // Additional fields
  model?: string;
  temperature?: number;
  first_speaker?: "FIRST_SPEAKER_USER" | "FIRST_SPEAKER_AGENT";
  selected_tools?: string[];
  selected_webhooks?: string[];
  knowledge_base_id?: string;
  is_appointment_booking_allowed?: boolean;
  appointment_tool_id?: string;
  is_call_transfer_allowed?: boolean;
  call_transfer_number?: string;
}

export interface SyncAgentRequest {
  id: string;
}

export interface AgentResponse {
  id: string;
  name: string;
  voice_id: string;
  system_prompt: string;
  model: string;
  temperature: number;
  first_speaker: string;
  selected_tools?: string[];
  selected_webhooks?: string[];
  call_transfer_number?: string;
  ultravox_agent_id?: string;
  ultravox_published_revision_id?: string;
  is_agent: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

class AgentService {
  private baseURL: string;

  constructor() {
    this.baseURL = env.NEXT_PUBLIC_BACKEND_URL_WORKER || "";
  }

  /**
   * Creates a new agent via Worker API
   * POST /api/agent
   */
  async createAgent(data: CreateAgentRequest): Promise<AgentResponse> {
    const endpoint = `${this.baseURL}/api/agent`;
    const method = "POST";

    try {
      logBotOperation("CREATE_REQUEST", data);

      logAPICall({
        method,
        endpoint,
        body: data,
        context: "AGENT_CREATE",
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      logAPICall({
        method,
        endpoint,
        response: responseData,
        context: "AGENT_CREATE",
      });

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to create agent");
      }

      logBotOperation("CREATE_SUCCESS", {
        bot_id: responseData.id,
        ultravox_agent_id: responseData.ultravox_agent_id,
        is_agent: responseData.is_agent,
      });

      return responseData;
    } catch (error) {
      logAPICall({
        method,
        endpoint,
        error,
        context: "AGENT_CREATE",
      });
      throw error;
    }
  }

  /**
   * Updates an existing agent's configuration (local DB only)
   * PATCH /api/agent
   * NOTE: Must call syncAgent() after update to push changes to Ultravox
   */
  async updateAgent(data: UpdateAgentRequest): Promise<AgentResponse> {
    const endpoint = `${this.baseURL}/api/agent`;
    const method = "PATCH";

    try {
      logBotOperation("UPDATE_REQUEST", data);

      logAPICall({
        method,
        endpoint,
        body: data,
        context: "AGENT_UPDATE",
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      logAPICall({
        method,
        endpoint,
        response: responseData,
        context: "AGENT_UPDATE",
      });

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to update agent");
      }

      logBotOperation("UPDATE_SUCCESS", {
        bot_id: data.id,
        updated_fields: Object.keys(data).filter((k) => k !== "id"),
      });

      return responseData;
    } catch (error) {
      logAPICall({
        method,
        endpoint,
        error,
        context: "AGENT_UPDATE",
      });
      throw error;
    }
  }

  /**
   * Syncs agent configuration to Ultravox
   * POST /api/agent/sync
   * CRITICAL: Must be called after updateAgent() to push changes to Ultravox
   */
  async syncAgent(botId: string): Promise<any> {
    const endpoint = `${this.baseURL}/api/agent/sync`;
    const method = "POST";
    const data: SyncAgentRequest = { id: botId };

    try {
      logAgentSync(botId, { action: "SYNC_START" });

      logAPICall({
        method,
        endpoint,
        body: data,
        context: "AGENT_SYNC",
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      logAPICall({
        method,
        endpoint,
        response: responseData,
        context: "AGENT_SYNC",
      });

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to sync agent");
      }

      logAgentSync(botId, {
        action: "SYNC_SUCCESS",
        ultravox_published_revision_id:
          responseData.ultravox_published_revision_id,
        last_synced_at: responseData.last_synced_at,
      });

      return responseData;
    } catch (error) {
      logAPICall({
        method,
        endpoint,
        error,
        context: "AGENT_SYNC",
      });
      throw error;
    }
  }

  /**
   * Deletes an agent (soft delete + Ultravox cleanup)
   * DELETE /api/agent?id={id}
   */
  async deleteAgent(botId: string): Promise<any> {
    const endpoint = `${this.baseURL}/api/agent?id=${botId}`;
    const method = "DELETE";

    try {
      logBotOperation("DELETE_REQUEST", { bot_id: botId });

      logAPICall({
        method,
        endpoint,
        context: "AGENT_DELETE",
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseData = await response.json();

      logAPICall({
        method,
        endpoint,
        response: responseData,
        context: "AGENT_DELETE",
      });

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to delete agent");
      }

      logBotOperation("DELETE_SUCCESS", { bot_id: botId });

      return responseData;
    } catch (error) {
      logAPICall({
        method,
        endpoint,
        error,
        context: "AGENT_DELETE",
      });
      throw error;
    }
  }

  /**
   * Gets a specific agent by ID
   * GET /api/agent/{id}
   */
  async getAgent(botId: string): Promise<AgentResponse> {
    const endpoint = `${this.baseURL}/api/agent/${botId}`;
    const method = "GET";

    try {
      logAPICall({
        method,
        endpoint,
        context: "AGENT_GET",
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseData = await response.json();

      logAPICall({
        method,
        endpoint,
        response: responseData,
        context: "AGENT_GET",
      });

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to get agent");
      }

      return responseData;
    } catch (error) {
      logAPICall({
        method,
        endpoint,
        error,
        context: "AGENT_GET",
      });
      throw error;
    }
  }

  /**
   * Gets all agents for a user
   * GET /api/agents?user_id={user_id}
   */
  async getAllAgents(userId: string): Promise<AgentResponse[]> {
    const endpoint = `${this.baseURL}/api/agents?user_id=${userId}`;
    const method = "GET";

    try {
      logAPICall({
        method,
        endpoint,
        context: "AGENTS_GET_ALL",
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseData = await response.json();

      logAPICall({
        method,
        endpoint,
        response: responseData,
        context: "AGENTS_GET_ALL",
      });

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to get agents");
      }

      return responseData;
    } catch (error) {
      logAPICall({
        method,
        endpoint,
        error,
        context: "AGENTS_GET_ALL",
      });
      throw error;
    }
  }
}

// Export singleton instance
export const agentService = new AgentService();
export default agentService;
