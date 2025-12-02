/**
 * API Logger Utility
 * Provides consistent, detailed logging for all API calls across the application
 */

export interface APILogConfig {
  method: string;
  endpoint: string;
  body?: any;
  response?: any;
  error?: any;
  context?: string;
  timestamp?: Date;
}

/**
 * Logs API call details to console with formatted output
 */
export function logAPICall(config: APILogConfig): void {
  const {
    method,
    endpoint,
    body,
    response,
    error,
    context = "API_CALL",
    timestamp = new Date(),
  } = config;

  const timeStr = timestamp.toISOString();
  const contextLabel = `[${context}]`;

  // Log request
  console.log(
    `\n🚀 ${contextLabel} ${method} ${endpoint}`,
    `\n⏰ Time: ${timeStr}`
  );

  if (body) {
    console.log("📤 Request Body:", JSON.stringify(body, null, 2));
  }

  // Log response or error
  if (error) {
    console.error("❌ Error:", error);
    if (error.response) {
      console.error("Response Data:", error.response.data);
      console.error("Status:", error.response.status);
    }
  } else if (response) {
    console.log("✅ Response:", JSON.stringify(response, null, 2));
  }

  console.log("─".repeat(80));
}

/**
 * Logs bot-related operations
 */
export function logBotOperation(operation: string, data: any): void {
  console.log(`\n🤖 [BOT_${operation.toUpperCase()}]`);
  console.log(JSON.stringify(data, null, 2));
  console.log("─".repeat(80));
}

/**
 * Logs agent sync operations
 */
export function logAgentSync(botId: string, syncData?: any): void {
  console.log(`\n🔄 [AGENT_SYNC] Bot ID: ${botId}`);
  if (syncData) {
    console.log("Sync Data:", JSON.stringify(syncData, null, 2));
  }
  console.log("─".repeat(80));
}

/**
 * Logs call operations (demo, Twilio, etc.)
 */
export function logCallOperation(
  callType: "DEMO" | "TWILIO" | "BULK",
  operation: string,
  data: any
): void {
  const emoji = callType === "DEMO" ? "📞" : callType === "TWILIO" ? "☎️" : "📢";
  console.log(`\n${emoji} [${callType}_CALL_${operation.toUpperCase()}]`);
  console.log(JSON.stringify(data, null, 2));
  console.log("─".repeat(80));
}

/**
 * Logs worker backend operations
 */
export function logWorkerOperation(operation: string, data: any): void {
  console.log(`\n⚙️ [WORKER_${operation.toUpperCase()}]`);
  console.log(JSON.stringify(data, null, 2));
  console.log("─".repeat(80));
}
