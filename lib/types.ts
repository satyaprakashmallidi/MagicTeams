export  interface CalendarAccount {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  calendar_email: string;
  expires_at: string;
}

// GHL Types
export interface GHLConnection {
  access_token: string;
  location_id: string;
  refresh_token?: string;
  expires_at?: string;
}

export interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  eventColor?: string;
  calendarType: string;
  teamMembers?: any[];
}

export interface GHLContact {
  id?: string;
  locationId?: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  firstNameRaw?: string;
  lastNameRaw?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  dnd?: boolean;
  type?: string;
  source?: string;
  assignedTo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  address1?: string;
  dateAdded?: string;
  dateUpdated?: string;
  dateOfBirth?: string;
  businessId?: string;
  tags?: string[];
  followers?: any[];
  country?: string;
  website?: string;
  timezone?: string;
  additionalEmails?: string[];
  attributions?: any[];
  dndSettings?: Record<string, any>;
  customFields?: Array<{
    id: string;
    value: string;
  }>;
}

export interface GHLEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  startTime?: string;
  endTime?: string;
  calendarId: string;
  contactId?: string;
  appointmentStatus: string;
  assignedUserId?: string;
  meetingLocationType?: string;
  meetingLocationId?: string;
  address?: string;
  notes?: string;
}

export interface GHLUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  extension?: string;
  roles?: any[];
  permissions?: any[];
}

export interface CreateEventPayload {
  title?: string;
  calendarId: string;
  locationId?: string;
  contactId: string;
  startTime: string;
  endTime?: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  meetingLocationType?: string;
  meetingLocationId?: string;
  overrideLocationConfig?: boolean;
  address?: string;
  ignoreDateRange?: boolean;
  toNotify?: boolean;
  ignoreFreeSlotValidation?: boolean;
  rrule?: string;
}

export interface UpdateEventPayload {
  title?: string;
  startTime?: string;
  endTime?: string;
  appointmentStatus?: string;
  address?: string;
  notes?: string;
  meetingLocationType?: string;
  meetingLocationId?: string;
  overrideLocationConfig?: boolean;
  assignedUserId?: string;
  calendarId?: string;
  ignoreDateRange?: boolean;
  toNotify?: boolean;
  ignoreFreeSlotValidation?: boolean;
  rrule?: string;
}


export interface Voice {
  voiceId: string;
  name: string;
  previewUrl: string;
}


// these are for Ultravox Espescially
export interface JoinUrlResponse {
  callId: string;
  created: Date;
  ended: Date | null;
  model: string;
  systemPrompt: string;
  temperature: number;
  joinUrl: string;
  error?: string;
}

// Enums
export enum RoleEnum {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
  TOOL_CALL = "TOOL_CALL",
  TOOL_RESULT = "TOOL_RESULT",
}

export enum ParameterLocation {
  UNSPECIFIED = "PARAMETER_LOCATION_UNSPECIFIED",
  QUERY = "PARAMETER_LOCATION_QUERY",
  PATH = "PARAMETER_LOCATION_PATH",
  HEADER = "PARAMETER_LOCATION_HEADER",
  BODY = "PARAMETER_LOCATION_BODY",
}

export enum KnownParamEnum {
  UNSPECIFIED = "KNOWN_PARAM_UNSPECIFIED",
  CALL_ID = "KNOWN_PARAM_CALL_ID",
  CONVERSATION_HISTORY = "KNOWN_PARAM_CONVERSATION_HISTORY",
}

export interface Message {
  ordinal?: number;
  role: RoleEnum;
  text: string;
  invocationId?: string;
  toolName?: string;
}

export interface SelectedTool {
  toolId?: string;
  toolName?: string;
  temporaryTool?: BaseToolDefinition;
  nameOverride?: string;
  authTokens?: { [key: string]: string };
  parameterOverrides?: { [key: string]: any };
}

export interface BaseToolDefinition {
  modelToolName?: string;
  description: string;
  dynamicParameters?: DynamicParameter[];
  staticParameters?: StaticParameter[];
  automaticParameters?: AutomaticParameter[];
  requirements?: ToolRequirements;
  http?: BaseHttpToolDetails;
  client?: {};
}

interface DynamicParameter {
  name: string;
  location: ParameterLocation;
  schema: object;
  required?: boolean;
}

interface StaticParameter {
  name: string;
  location: ParameterLocation;
  value: any;
}

interface AutomaticParameter {
  name: string;
  location: ParameterLocation;
  knownValue: KnownParamEnum;
}

interface BaseHttpToolDetails {
  baseUrlPattern: string;
  httpMethod: string;
}

interface ToolRequirements {
  httpSecurityOptions: SecurityOptions;
  requiredParameterOverrides: string[];
}

interface SecurityOptions {
  options: SecurityRequirements[];
}

interface SecurityRequirements {
  requirements: { [key: string]: SecurityRequirement };
}

interface SecurityRequirement {
  queryApiKey?: QueryApiKeyRequirement;
  headerApiKey?: HeaderApiKeyRequirement;
  httpAuth?: HttpAuthRequirement;
}

interface QueryApiKeyRequirement {
  name: string;
}

interface HeaderApiKeyRequirement {
  name: string;
}

interface HttpAuthRequirement {
  scheme: string;
}

export interface CallConfig {
  systemPrompt: string;
  model?: string;
  languageHint?: string;
  tools?: SelectedTool[];
  initialMessages?: Message[];
  voice?: string;
  temperature?: number;
  maxDuration?: string;
  timeExceededMessage?: string;
  callKey?: string;
  recordingEnabled?: boolean;
  medium?: {
    twilio?: {};
  };
  botId?: string | null;
  experimentalSettings?: {
    backSeatDriver?: boolean;
  };
  metadata?: {
    [key: string]: string;
  };
  transfer_to?: string;
  from_number?: string;
  to_number?: string;
  placeholders?: Record<string, string>;
  firstSpeaker?: "FIRST_SPEAKER_AGENT" | "FIRST_SPEAKER_USER";
}

export interface DemoConfig {
  title: string;
  overview: string;
  callConfig: CallConfig;
}

// Call Stages
export enum AvailableCallStage {
  STAGE0 = "Stage-0",
  STAGE1 = "Stage-1",
}

export interface CallStageTask {
  stageNumber: number;
  stageName?: AvailableCallStage;
  stageDescription?: string;
  stagePrompt?: string;
}

export interface NavigateConversation {
  data: object;
  new_data: object;
  next_stage: AvailableCallStage | undefined;
  current_stage: AvailableCallStage;
}

export interface TwilioConfig {
  id?: string | undefined;
  auth_token: string;
  account_sid: string;
  from_number: string;
  to_number?: string | undefined;
}


export interface Appointment {
  id: string;
  bot_id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
}



//cal-com types
export interface CalComBooking {
  id: number;
  uid: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{
    email: string;
    name: string;
  }>;
  eventTypeId: number;
  status: string;
  location: string;
  organizer: {
    email: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CalComUserInfo {
  id: number;
  email: string;
  timeFormat: number;
  defaultScheduleId: number;
  weekStart: string;
  timeZone: string;
  username: string;
  organizationId: number | null;
}

export interface CalComEventType {
  id: number;
  eventId: number; 
  ownerId: number;
  lengthInMinutes: number;
  title: string;
  slug: string;
  description: string;
  locations: Array<{
    type: string;
    integration?: string;
  }>;
  bookingFields: any[];
  users: Array<{
    id: number;
    name: string;
    username: string;
    avatarUrl: string;
  }>;
}
