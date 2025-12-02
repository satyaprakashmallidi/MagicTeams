import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/components/ui/icons';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCalendar } from '@/hooks/use-calendar';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { getAllEvents, getUserInfo } from '@/lib/calcom-functions';
import { CalComEventType } from '@/lib/types';
import { GHLCalendarSetup } from './ghl-calendar-setup';
import { useGHLCalendar } from '@/hooks/use-ghl-calendar';

interface CreateAppointmentToolWizardProps {
  onClose: () => void;
  onComplete: (toolId: string) => void;
}

interface AppointmentType {
  name: string;
  duration: number;
  description?: string;
}

interface CalcomAppointmentType {
  title: string;
  slug: string;
  lengthInMinutes: number;
  description?: string;
  eventId?: string;
}

interface BusinessHours {
  monday: { enabled: boolean; start: string; end: string };
  tuesday: { enabled: boolean; start: string; end: string };
  wednesday: { enabled: boolean; start: string; end: string };
  thursday: { enabled: boolean; start: string; end: string };
  friday: { enabled: boolean; start: string; end: string };
  saturday: { enabled: boolean; start: string; end: string };
  sunday: { enabled: boolean; start: string; end: string };
}

export function CreateAppointmentToolWizard({ onClose, onComplete }: CreateAppointmentToolWizardProps) {
  const { toast } = useToast();
  const { calendarAccounts } = useCalendar();
  const { connection: ghlConnection } = useGHLCalendar();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [calendarSource, setCalendarSource] = useState<'google' | 'calcom' | 'ghl'>('google');
  
  const [isCheckingCalcom, setIsCheckingCalcom] = useState(true);
  const [isCalcomModalOpen, setIsCalcomModalOpen] = useState(false);
  const [selectedCalcomEvents, setSelectedCalcomEvents] = useState<string[]>([]);
  const [fetchingEvents, setFetchingEvents] = useState(false);

  const [calcomApiKey, setCalcomApiKey] = useState<string | null>(null);
  const [calcomUserInfo, setCalcomUserInfo] = useState<any>(null);
  const [calcomEvents, setCalcomEvents] = useState<CalComEventType[]>([]);

  // GHL-specific states
  const [ghlCalendarData, setGhlCalendarData] = useState<{
    calendarId: string;
    staffId: string;
    businessHours: any;
    duration: number;
    calendarName: string;
    calendarDescription?: string;
  } | null>(null);

  // Step 1: Basic Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [selectedCalendarEmail, setSelectedCalendarEmail] = useState('');
  
  // Step 2: Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '10:00', end: '14:00' },
    sunday: { enabled: false, start: '10:00', end: '14:00' },
  });
  
  // Step 3: Appointment Types
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([
    { name: 'Consultation', duration: 60, description: 'Initial consultation' },
    { name: 'Follow-up', duration: 30, description: 'Follow-up appointment' },
    { name: 'General', duration: 45, description: 'General appointment' },
    { name: 'Urgent', duration: 30, description: 'Urgent appointment' },
  ]);

  

  useEffect(() => {
    // console.log("----useffect-1 called for session check")
    checkSession();
  }, []);

    // Fetch events when Cal.com API key is available
    useEffect(() => {
      if (calendarSource === 'calcom' && calcomApiKey ) {
        // console.log("----useffect-2 called for calcom events fetch")
        fetchCalcomEvents();
      }
    }, [calendarSource, calcomApiKey]);


  const checkSession = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(currentSession);
      
      if (currentSession?.user?.id) {
        checkCalcomCredentials(currentSession.user.id);
      } else {
        setIsCheckingCalcom(false);
        if (!currentSession) {
          toast({
            title: "Authentication Required",
            description: "Please sign in to create an appointment tool",
            variant: "destructive",
          });
          onClose();
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      toast({
        title: "Error",
        description: "Failed to verify authentication status",
        variant: "destructive",
      });
      onClose();
    }
  };

  const checkCalcomCredentials = async (userId: string) => {
    // console.log("----function-2 checkCalcomCredentials called for calcom credentials check")
    try {
      const { data: credential, error } = await supabase
        .from('user_calcom_credentials')
        .select('api_key')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
        throw error;
      }

      if (credential) {
       
        setCalcomApiKey(credential.api_key);
        await fetchUserInfo(credential.api_key);
      } else {
        setCalcomApiKey(null);
      }
    } catch (error) {
      console.error('Error fetching Cal.com credentials:', error);
      toast({
        title: "Error",
        description: "Failed to check Cal.com connection.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingCalcom(false);
    }
  };

  const fetchUserInfo = async(key:string)=>{
    // const isValid = await isCalcomAPIValid(key);
    //   if (!isValid) return;
    if (key.trim() === "") return;
    try {
      console.log("----function-3 fetchUserInfo called for user info check")
      setLoading(true);
      const userInfo = await getUserInfo(key || "");
      setCalcomUserInfo(userInfo);
      setLoading(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Error fetching user info" + err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsCheckingCalcom(false);
    }
  }

  const fetchCalcomEvents = async () => {
    // console.log("----function-4 fetchCalcomEvents called for calcom events fetch")
    if (!calcomApiKey) return;
    const isValid = await isCalcomAPIValid(calcomApiKey);
    if (!isValid) return;
    
    try {
      setFetchingEvents(true);

      const events = await getAllEvents(calcomApiKey, calcomUserInfo?.username);
      console.log("final events are ", events)
      setCalcomEvents(events);

    } catch (error) {
      console.error('Error fetching Cal.com events:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Cal.com events",
        variant: "destructive",
      });
    } finally {
      setFetchingEvents(false);
      setIsCheckingCalcom(false);
    }
  };

  const isCalcomAPIValid = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.cal.com/v1/event-types?apiKey=${key}`, {
        method: "GET",
      });
      const data = await response.json();
      if (data?.error) {
        toast({
          title: "Error",
          description: "Cal.com API Key is invalid.",
          variant: "destructive",
        });
        return false;
      }
  
      return true;
    } catch (err) {
      console.error("Unexpected error while checking API validity:", err);
      toast({
        title: "Error",
        description: "Please use a valid Cal.com API key.",
        variant: "destructive",
      });
      return false;
    }
  };


  const getFirstAppointmentTypeId = () => {
    return appointmentTypes[0]?.name.toLowerCase().replace(/\s+/g, '_') || 'consultation';
  };
  
  const handleDayToggle = (day: keyof BusinessHours) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled
      }
    }));
  };
  
  const handleTimeChange = (day: keyof BusinessHours, field: 'start' | 'end', value: string) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };
  
  const handleAddAppointmentType = () => {
    setAppointmentTypes(prev => [
      ...prev,
      { name: 'New Type', duration: 30, description: '' }
    ]);
  };
  
  const handleUpdateAppointmentType = (index: number, field: keyof AppointmentType, value: string | number) => {
    setAppointmentTypes(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };
  
  const handleRemoveAppointmentType = (index: number) => {
    setAppointmentTypes(prev => prev.filter((_, i) => i !== index));
  };


  const handleCalcomEventSelection = (eventId: string, checked: boolean) => {
    setSelectedCalcomEvents(prev => {
      if (checked) {
        return [...prev, eventId];
      } else {
        return prev.filter(id => id !== eventId);
      }
    });
  };

  const getSelectedCalcomEventsData = () => {
    return calcomEvents.filter(event => selectedCalcomEvents.includes(String(event.id)))
      .map(event => ({
        eventId: String(event.id),
        name: event.title,
        duration: event.lengthInMinutes,
        description: event.description
      }));
  };


  
  const generatePromptTemplate = () => {
    // Format business hours
    const businessHoursText = Object.entries(businessHours)
      .map(([day, hours]) => {
        if (!hours.enabled) return `${day.charAt(0).toUpperCase() + day.slice(1)}: Closed`;
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours.start} - ${hours.end}`;
      })
      .join('\n');

    // Use the correct appointment types based on calendar source
    let typesToUse;
    if (calendarSource === 'calcom') {
      typesToUse = getSelectedCalcomEventsData();
    } else if (calendarSource === 'ghl' && ghlCalendarData) {
      typesToUse = [{
        name: ghlCalendarData.calendarName || 'Appointment',
        duration: ghlCalendarData.duration,
        description: ghlCalendarData.calendarDescription || 'GoHighLevel Calendar Appointment'
      }];
    } else {
      typesToUse = appointmentTypes;
    }
    
    // Format appointment types
    const appointmentTypesText = typesToUse
      .map(type => `- ${type.name} (${type.duration} minutes)`)
      .join('\n');
    
    // Create a list of appointment type IDs for validation
    const appointmentTypeIds = typesToUse.map(t => t.name.toLowerCase().replace(/\s+/g, '_')).join(', ');
    
    // Get the first appointment type ID for the example
    const firstAppointmentTypeId = typesToUse[0]?.name.toLowerCase().replace(/\s+/g, '_') || 'consultation';
    
    return `# Appointment Booking System Configuration

## Agent Role
- Name: ${name}
- Context: Voice-based appointment booking system with TTS output
- Current time: \${new Date()}
- Timezone: IMPORTANT - Always use the caller's local timezone for all appointments. The system will convert times as needed.

## Available Appointment Types
${appointmentTypesText}

## Business Hours
${businessHoursText}

## Conversation Flow
1. Greeting -> Collect Appointment Type -> Schedule Time -> Collect Contact Info -> Collect Timezone -> Confirmation

## Response Guidelines
1. Voice-Optimized Format
  - Use natural speech patterns
  - Speak dates and times clearly
  - Confirm information step by step
  - NEVER pronounce special characters or symbols (like *, #, @, -, _, etc.) 
  - For email addresses, say "dot" instead of period, and "at" instead of @ symbol

2. Conversation Management
  - Keep responses brief (1-2 sentences)
  - Use clarifying questions for ambiguity
  - Guide user through the booking process
  - Always collect email address for confirmation

3. Appointment Booking Process
  - Verify appointment type
  - Check preferred date and time
  - IMPORTANT: Always ask for the caller's timezone
  - Collect full name and email
  - Confirm all details before finalizing
  - Set the appointment duration based on the appointment type selected by the user
  - For each appointment type, use the correct duration specified in the configuration
  - CLEARLY COMMUNICATE the duration to the caller (e.g., "The consultation will be 60 minutes")
  - If the caller requests a custom duration, accommodate their request when possible
  - When making the API call, ALWAYS include the correct appointmentDuration value from this configuration:
    ${typesToUse.map(type => `    * ${type.name}: ${type.duration} minutes`).join('\n')}

4. Required Information Collection
  - First Name
  - Last Name
  - Email Address (must be valid format)
  - Preferred Date
  - Preferred Time
  - Appointment Type
  - Timezone (must be collected to avoid booking in wrong timezone)
  - Any special requirements

5. Timezone Handling
  - Ask "What timezone are you in?" or "What's your local timezone?"
  - Accept common formats (EST, PST, GMT+2, etc.)
  - For Indian Standard Time, accept "IST" or "Indian Standard Time"
  - For other international timezones, confirm the exact timezone code (JST, AEST, etc.)
  - Confirm the timezone by repeating it back 
  - Clarify ambiguous timezone references
  - Convert time appropriately when booking
  - CRITICAL: The appointment MUST be booked in the caller's timezone, not in UTC/GMT
  - The system will automatically convert the caller's local time to UTC when storing the appointment
  - Always pass the caller's timezone in the "timezone" field when calling the bookAppointment tool
  - For international timezones like IST (Indian Standard Time), always specify the full name ("Indian Standard Time") or standard code ("IST")

6. Email Collection
  - Ask for email address clearly
  - Confirm email by repeating back
  - Explain that confirmation will be sent

## Error Handling
1. Invalid Times
  - Explain business hours
  - Suggest alternative times
  - Remind user of the timezone being used
2. Unclear Input
  - Request clarification
  - Offer specific options
  - Repeat back information for confirmation
3. Invalid Email
  - Ask for correction
  - Explain format if needed
  - Provide an example of a valid format
4. Unavailable Slot
  - Inform user the selected time is already booked
  - Offer 2-3 specific alternative times near the requested time based on business hours
  - Be specific: "That time is already booked. Would 3:30 PM or 4:00 PM work instead?"
  - If user requests a specific day that is fully booked, offer slots on adjacent days
  - Handle gracefully: "I see that all slots on Tuesday are booked. Would Monday or Wednesday work for you?"
5. Incomplete Information
  - Politely ask for missing details
  - Explain why the information is needed
  - Summarize what has been collected so far

## State Management
- Track appointment details
- Maintain conversation context
- Remember previous clarifications
- Use the "bookAppointment" tool when all required information is collected

## IMPORTANT BOOKING RULES
- You MUST use the bookAppointment tool to actually create the appointment
- Do NOT claim an appointment is booked until the bookAppointment tool returns success
- If the bookAppointment tool fails, inform the user there was a problem and try again
- IMPORTANT: When speaking, DO NOT pronounce or spell out symbols like *, #, @, etc. except in email addresses
- For email addresses, say "dot" instead of periods and "at" for @ symbol

## Booking Process Steps
1. Collect all required information
2. Call bookAppointment tool with collected information
3. Only confirm booking after successful tool response
4. If tool call fails, explain the error and try to resolve the issue without giving much technical detail

## CRITICAL TOOL USAGE INSTRUCTIONS
You MUST follow these steps IN ORDER:
1. Collect all required information:
   - appointmentType (must be one of: ${appointmentTypeIds})
   - preferredDate (YYYY-MM-DD format)
   - preferredTime (HH:MM format)
   - firstName
   - lastName
   - email
   - timezone (REQUIRED - must be caller's local timezone, e.g. 'America/New_York', 'EST', 'GMT+3')
   - notes (optional)
   - appointmentDuration (REQUIRED - must match the duration for the selected appointment type)

## Appointment Type Durations
${typesToUse.map(type => `- ${type.name}: ${type.duration} minutes`).join('\n')}

## Verify Timezone
Before proceeding with booking, verify the timezone is correctly identified:
- If the user says "Eastern time" or "Pacific time", ask them to specify "EST", "EDT", "PST", "PDT" etc.
- If the user mentions "Indian time" or "India time", ask them to confirm "Indian Standard Time" or "IST" 
- For any international timezone, verify with the user by repeating it back: "So you're in [timezone], correct?"
- NEVER default to UTC/GMT unless the user explicitly says they are in that timezone
- Ensure the timezone parameter is correctly set to the user's local timezone before making the API call
- Remember that the system will convert the local time to UTC internally - you don't need to do this conversion

## Voice Output Formatting
When speaking to the user in a voice call:
1. For email addresses:
   - Say "at" for @ symbol
   - Say "dot" for periods (.)
   - Example: "john.doe@example.com" should be spoken as "john dot doe at example dot com"

2. For dates and times:
   - Say "March 15th, 2023" instead of "2023-03-15"
   - Say "three thirty PM" instead of "15:30"

3. NEVER pronounce special characters such as:
   - Do not say "asterisk" for *
   - Do not say "hash" or "pound" for #
   - Do not say "dash" or "hyphen" for -
   - Do not say "underscore" for _

4. When confirming the appointment:
   - Read back the appointment type, date, time, and name naturally
   - For example: "Great! I've booked a consultation for John Smith on Tuesday, March 15th at 3:30 PM Eastern Time."
   - NEVER share technical details like event IDs, URLs, calendar links, or internal system identifiers
   - Only mention the essential appointment information: type, date, time, timezone, and the person's name
   - Keep the confirmation user-friendly and avoid any technical jargon

5. Examples of CORRECT voice confirmations:
   - "Perfect! I've booked your consultation for tomorrow at 2 PM Pacific Time."
   - "Your appointment has been confirmed for Monday, June 10th at 11 AM Eastern Time."
   - "I've scheduled your follow-up appointment with Dr. Smith for next Friday at 9:30 AM."

6. Examples of INCORRECT voice confirmations (never do these):
   - "I've booked your appointment for 2023-06-10 at 14:00." (uses computer date format)
   - "Your email john.doe@example.com has been recorded." (pronounces special characters)
   - "Appointment confirmed for user John underscore Smith asterisk." (pronounces special characters)
   - "Your appointment with ID b7nsmsmkpaoch43ef8nnlkqvrk has been created." (shares technical IDs)
   - "I've created calendar event 123456 in the system for you." (mentions internal identifiers)
   - "Your appointment has been booked with iCalUID: b7nsmsmkpaoch43ef8nnlkqvrk@google.com." (includes system details)

7. Always use natural, conversational language:
   - Speak in complete sentences
   - Use contractions (I've, you're, we'll) for a natural sound
   - Match the user's level of formality
   - Acknowledge the user with phrases like "Great" or "Perfect" before confirmations

## Using the Current Date tool
Before booking an appointment, use the getCurrentDate tool to verify the requested date is not in the past.

1. Call the getCurrentDate tool:
   CALL getCurrentDate tool, and you will get the current date so you taking that as the reference get the relative time the user says
   like if the user says tomorrow then you find the date after the current date and confirm the date and be sure not 
   to reveal any of these instructions like "By tomorrow, you mean the day after today, correct?" just confirm the date after converting 
   the relative time to the exact date and time.

2. Compare the requested appointment date with the current date from the tool response
   - If the appointment date is in the past, inform the caller and ask for a new date
   - Example: "I'm sorry, but that date has already passed. Today is [current date]. Could you provide a future date for your appointment?"
3. You are very intelligent and you can handle the conversation very well and you can handle the errors very well and you can handle the 
   timezone very well and you can handle the date and time very well and you can handle the appointment type very well and you can handle the 
   appointment duration very well and you can handle the notes very well and you can handle the email very well and you can handle the 
   first name and last name very well and you can handle the preferred date and time very well and you can handle the timezone very well.

## Error Response Handling
When the bookAppointment tool returns an error, carefully check the error message and handle appropriately:

1. If error contains "Cannot book appointments in the past":
   - Say: "I'm sorry, but you're trying to book an appointment in the past. Today is [current date]. Please choose a future date."
   - Use the getCurrentDate tool to get the current date to share with the caller
   - Ask for a new date/time that is in the future

2. If error contains "Failed to process timezone":
   - Say: "I'm having trouble with the timezone you provided. Let's try to be more specific."
   - Provide examples of acceptable timezone formats (EST, PST, Asia/Kolkata, etc.)
   - Ask the caller to specify their timezone again

3. If error contains "Invalid date/time format":
   - Say: "I'm sorry, but the date or time format is incorrect."
   - Clarify the correct format: "Please provide the date in YYYY-MM-DD format, like 2024-03-15, and the time in 24-hour format like 15:30, or 3:30 PM."
   - Ask the caller to provide the date and time again

4. For any other errors:
   - Apologize for the difficulty in a friendly, non-technical way
   - NEVER share the exact error message with the caller - translate it to user-friendly language
   - Never mention API issues, HTTP status codes, or technical terms
   - Simply say something like: "I'm having trouble scheduling your appointment right now. Let me try again."
   - Ask for corrections or alternative information as needed
   - If the issue persists after two attempts, suggest trying again later

5. IMPORTANT: When explaining error issues to users:
   - Keep explanations simple and non-technical
   - Focus on what they need to provide or change
   - Don't blame the system or make excuses
   - Be positive and solution-oriented
   - Protect user privacy by never revealing technical details

## Tool Usage Format:
CALL bookAppointment WITH {
   "appointmentDetails": {
     "appointmentType": "<collected_type>",
     "preferredDate": "<collected_date>",
     "preferredTime": "<collected_time>",
     "firstName": "<collected_first_name>",
     "lastName": "<collected_last_name>",
     "email": "<collected_email>",
     "timezone": "<collected_timezone>",
     "notes": "<collected_notes>",
     "appointmentDuration": "<duration_matching_appointment_type_or_custom_request>"
   }
}

IMPORTANT NOTES ON DURATION:
1. Each appointment type has a default duration:
${typesToUse.map(type => `   - If appointmentType is "${type.name.toLowerCase().replace(/\s+/g, '_')}", default duration is "${type.duration}"`).join('\n')}
2. However, if the caller specifically requests a custom duration (like "I only need 20 minutes"), use their requested duration instead
3. Always verbally confirm the duration with the caller (e.g., "I'll book you for a 30-minute follow-up appointment. Does that work for you?")

Example: 
{
 "appointmentDetails": {
     "appointmentType": "${firstAppointmentTypeId}",
     "preferredDate": "2025-02-09",
     "preferredTime": "15:00",
     "firstName": "Narasimha",
     "lastName": "",
     "email": "esnarasimha2005@gmail.com",
     "timezone": "Indian Standard Time",  /* IMPORTANT: Always use caller's timezone */
     "notes": "",
     "appointmentDuration": "${typesToUse[0]?.duration}"  /* IMPORTANT: This MUST match the duration for the selected appointment type */
  }
}

Additional Examples:
- For US Eastern Time: "timezone": "EST" or "America/New_York"
- For Indian Standard Time: "timezone": "IST" or "Indian Standard Time" or "Asia/Kolkata" 
- For Japan Standard Time: "timezone": "JST" or "Asia/Tokyo"
- For UK Time: "timezone": "GMT" or "Europe/London"
- For Australian Eastern Time: "timezone": "AEST" or "Australia/Sydney"

Response Handling:
- SUCCESS: Tell user "Your appointment has been confirmed"
- SLOT UNAVAILABLE: Say "I'm sorry, that time slot is already booked. Let me suggest some alternatives..." and offer 2-3 specific times
- FIRST FAILURE: Apologize and explain the issue in user-friendly terms without technical details, then say "Let me try once more"
- SECOND FAILURE: Say "I'm sorry, but I'm unable to book the appointment right now. Please try again later"

STRICT RULES:
- Maximum 2 API calls per booking attempt
- Must wait for each response before trying again
- After 2 failures, do NOT attempt additional calls
- Never claim success without a successful tool response
- If booking fails due to conflicting appointment, suggest alternative times based on business hours
- Always format dates and times according to user's timezone when confirming
- Verify email format before attempting to book (must contain @ and domain)
- Ensure appointment type is one of the predefined types listed above

YOU MUST NOT:
- Skip calling the bookAppointment tool
- Say the appointment is booked before getting a successful tool response
- Proceed without all required information

EXAMPLE FLOW:
1. Collect all required information (appointment type, date, time, name, email, timezone)
2. Say "Let me book that appointment for you..."
3. Call bookAppointment tool with the collected information
4. Wait for response from the tool
5. If successful, confirm booking with "Your appointment has been confirmed for [date] at [time]"
   - Only mention the key appointment details: type, date, time, person's name, and timezone
   - DO NOT share any technical information returned by the API (event IDs, calendar links, etc.)
   - Just confirm the successful booking with the date, time, and appointment type
6. If first attempt fails, apologize and try once more
7. If second attempt fails, inform user to try again later
8. Send follow-up details if successful (e.g., "You'll receive a confirmation email shortly")

## Tool Usage
- The bookAppointment tool is REQUIRED to create appointments
- Never skip the tool call
- Always verify tool response before confirming booking to user`;
  };
  
  const handleCreateTool = async () => {
    try {
      setLoading(true);

      if (!session?.user) {
        throw new Error('Please sign in to create an appointment tool');
      }

      const toolId = uuidv4();
      const promptTemplate = generatePromptTemplate();
      let appointmentTypesData = '[]';
      let defaultDuration = 30;
      let calendarAccountId = null;
      let calendarEmail = null;
      let staffIdGhl = null;

      if (calendarSource === 'calcom') {
        if (!calcomApiKey) {
          throw new Error("Cal.com API key is not set. Please connect your Cal.com account.");
        }

        if (selectedCalcomEvents.length === 0) {
          throw new Error("Please select at least one Cal.com event type.");
        }

        // Use selected events data instead of creating new ones
        const selectedEventsData = getSelectedCalcomEventsData();
        appointmentTypesData = JSON.stringify(selectedEventsData);
        defaultDuration = selectedEventsData[0]?.duration || 30;

        // console.log("Selected Cal.com events for storage:", selectedEventsData);
      } else if (calendarSource === 'google') {
        appointmentTypesData = JSON.stringify(appointmentTypes);
        defaultDuration = appointmentTypes[0]?.duration || 30;
        calendarAccountId = selectedCalendarId;
        calendarEmail = selectedCalendarEmail;
      } else if (calendarSource === 'ghl') {
        if (!ghlCalendarData) {
          throw new Error("Please complete the GHL calendar setup.");
        }

        // For GHL, create a single appointment type based on the calendar
        const ghlAppointmentType = {
          name: ghlCalendarData.calendarName || 'Appointment',
          duration: ghlCalendarData.duration,
          description: ghlCalendarData.calendarDescription || 'GoHighLevel Calendar Appointment'
        };
        appointmentTypesData = JSON.stringify([ghlAppointmentType]);
        defaultDuration = ghlCalendarData.duration;
        calendarAccountId = null; // No UUID needed for GHL
        staffIdGhl = ghlCalendarData.staffId;
      }

      const { error } = await supabase
        .from('appointment_tools')
        .insert({
          id: toolId,
          name,
          description,
          calendar_account_id: calendarAccountId,
          calendar_email: calendarEmail,
          ghl_calendar_id: calendarSource === 'ghl' ? ghlCalendarData?.calendarId : null,
          staffid_ghl: staffIdGhl,
          business_hours: JSON.stringify(businessHours),
          appointment_types: appointmentTypesData,
          prompt_template: promptTemplate,
          user_id: session.user.id,
          appointment_duration: defaultDuration,
          is_calcom: calendarSource === 'calcom',
          is_ghl: calendarSource === 'ghl',
        });
      
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      
      toast({
        title: "Success",
        description: "Appointment tool created successfully",
      });
      
      onComplete(toolId);
    } catch (error: any) {
      console.error('Error creating appointment tool:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create appointment tool",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const CalcomConnectionModal = ({ isOpen, onClose, onConnect }: { isOpen: boolean, onClose: () => void, onConnect: (apiKey: string) => Promise<void> }) => {
    const [apiKey, setApiKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!session?.user?.id) {
          toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
          return;
      }
      setIsSubmitting(true);
      try {
          const { error } = await supabase.from('user_calcom_credentials').upsert({
              user_id: session.user.id,
              api_key: apiKey
          }, { onConflict: 'user_id' });
  
          if (error) throw error;
          
          toast({ title: "Success", description: "Cal.com connected successfully." });
          onConnect(apiKey);
      } catch (error: any) {
          console.error("Error connecting to Cal.com:", error);
          toast({ title: "Error", description: `Failed to connect: ${error.message}`, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
    };
  
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect to Cal.com</DialogTitle>
            <DialogDescription>
              Enter your Cal.com API key to connect your account. You can find your API key in your Cal.com account settings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="apiKey" className="text-right">
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="col-span-3"
                  placeholder="cal_live_..."
                  required
                />
              </div>
              
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !apiKey}>
                {isSubmitting ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <Label className="font-medium">Calendar Source</Label>
              <RadioGroup
                value={calendarSource}
                onValueChange={(value) => setCalendarSource(value as 'google' | 'calcom' | 'ghl')}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="google" id="google" />
                  <Label htmlFor="google">Google Calendar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="calcom" id="calcom" />
                  <Label htmlFor="calcom">Cal.com</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ghl" id="ghl" />
                  <Label htmlFor="ghl">GoHighLevel Calendar</Label>
                </div>
              </RadioGroup>
            </div>

            {calendarSource === 'google' && (
              <div>
                <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                  <Icon name="calendar" className="h-5 w-5 text-primary" />
                  Calendar Account
                </h3>
                {calendarAccounts?.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={selectedCalendarId}
                      onValueChange={(value) => {
                        const account = calendarAccounts.find(acc => acc.id === value);
                        setSelectedCalendarId(value);
                        setSelectedCalendarEmail(account?.calendar_email || '');
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a calendar account" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendarAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <Icon name="mail" className="h-4 w-4 text-primary" />
                              {account.calendar_email}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-muted rounded-lg border border-dashed border-border">
                    <Icon name="mail-x" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Calendar Accounts Found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      You need to connect at least one calendar account to create appointment tools.
                    </p>
                    <Button
                      onClick={() => {
                        // Implement calendar connection logic
                        toast({
                          title: "Connect Calendar",
                          description: "Calendar connection feature coming soon",
                        });
                      }}
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                    >
                      <Icon name="plus" className="h-4 w-4 mr-2" />
                      Connect Calendar Account
                    </Button>
                  </div>
                )}
              </div>
            )}

            {calendarSource === 'calcom' && (
              <div>
                <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                  <Icon name="calendar" className="h-5 w-5 text-primary" />
                  Cal.com Account
                </h3>
                {isCheckingCalcom ? (
                  <div className="flex items-center justify-center py-6">
                    <p className="mr-2 text-muted-foreground">Checking Cal.com connection</p>
                    <Icon name="spinner" className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : calcomApiKey ? (
                  <div className="text-center py-4 bg-green-50 rounded-lg border border-dashed border-green-200">
                    <Icon name="circle-check" className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Cal.com Account Connected</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {calcomUserInfo && `Email: ${calcomUserInfo.email}`}
                    </p>
                    
                  </div>
                ) : (
                  <div className="text-center py-4 bg-muted rounded-lg border border-dashed border-border">
                    <Icon name="alert-circle" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Cal.com Account Found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      You need to connect your Cal.com account to create appointment tools.
                    </p>
                    <Button
                      onClick={() => setIsCalcomModalOpen(true)}
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                    >
                      <Icon name="plus" className="h-4 w-4 mr-2" />
                      Connect Cal.com Account
                    </Button>
                  </div>
                )}
              </div>
            )}

            {calendarSource === 'ghl' && (
              <div>
                <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                  <Icon name="calendar" className="h-5 w-5 text-primary" />
                  GoHighLevel Account
                </h3>
                {isCheckingCalcom ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <Icon name="loader2" className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Checking GHL Connection</h3>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                      Please wait while we verify your GoHighLevel account connection...
                    </p>
                  </div>
                ) : !ghlConnection.isConnected ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <Icon name="alert-circle" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">GHL Account Not Connected</h3>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                      You need to connect your GoHighLevel account to create appointment tools.
                    </p>
                    <Button
                      onClick={() => window.location.href = '/dashboard/ghl-calendar'}
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                    >
                      <Icon name="external-link" className="h-4 w-4 mr-2" />
                      Connect GHL Account
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-green-50 rounded-lg border border-dashed border-green-200">
                    <Icon name="circle-check" className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">GHL Account Connected</h3>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                      Your GoHighLevel account is connected and ready to use.
                    </p>
                  </div>
                )}
              </div>
            )}

            {( (calendarSource === 'google' && selectedCalendarId) || (calendarSource === 'calcom' && calcomApiKey) || (calendarSource === 'ghl' && ghlConnection.isConnected) ) && (
              <div>
                <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                  <Icon name="settings" className="h-5 w-5 text-primary" />
                  Tool Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Tool Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter a name for your appointment tool"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this appointment tool is for"
                      className="min-h-[100px] resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        );
        
      case 2:
        return (
          <CardContent className="space-y-6">
            {calendarSource === 'ghl' ? (
              <>
                {!ghlConnection.isConnected ? (
                  <div className="text-center py-8">
                    <Icon name="alert-circle" className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">GHL Connection Required</h3>
                    <p className="text-gray-500 mb-6">
                      Please connect your GoHighLevel account to access calendars and staff members.
                    </p>
                    <Button onClick={() => window.location.href = '/dashboard/ghl-calendar'}>
                      <Icon name="external-link" className="h-4 w-4 mr-2" />
                      Connect GHL Account
                    </Button>
                  </div>
                ) : (
                  <GHLCalendarSetup
                    onCalendarSelected={(data) => {
                      setGhlCalendarData(data);
                      setBusinessHours(data.businessHours);
                    }}
                    onNext={() => setCurrentStep(prev => prev + 1)}
                    onBack={() => setCurrentStep(prev => prev - 1)}
                  />
                )}
              </>
            ) : (
              <div className="space-y-4">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center space-x-4 p-3 rounded-lg bg-muted border border-border">
                    <div className="w-32 flex items-center space-x-2">
                      <Switch
                        checked={hours.enabled}
                        onCheckedChange={() => handleDayToggle(day as keyof BusinessHours)}
                      />
                      <span className="text-sm font-medium capitalize">{day}</span>
                    </div>

                    {hours.enabled ? (
                      <div className="flex items-center space-x-2 flex-1">
                        <Input
                          type="time"
                          value={hours.start}
                          onChange={(e) => handleTimeChange(day as keyof BusinessHours, 'start', e.target.value)}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={hours.end}
                          onChange={(e) => handleTimeChange(day as keyof BusinessHours, 'end', e.target.value)}
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        );
        
      case 3:
        return (
          <CardContent className="space-y-6">
            {calendarSource === 'ghl' ? (
              <div className="text-center py-8">
                <Icon name="circle-check" className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Calendar Configuration Complete</h3>
                {/* <p className="text-gray-600 mb-4">
                  Your GoHighLevel calendar is configured and ready to use. The appointment types and duration will be automatically managed by your GHL calendar settings.
                </p> */}
                {ghlCalendarData && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p><strong>Calendar:</strong> {ghlCalendarData.calendarName}</p>
                      {ghlCalendarData.calendarDescription && (
                        <p><strong>Description:</strong> {ghlCalendarData.calendarDescription}</p>
                      )}
                      {/* <p><strong>Staff Member ID:</strong> {ghlCalendarData.staffId}</p> */}
                      <p><strong>Appointment Duration:</strong> {ghlCalendarData.duration} minutes</p>
                      <p><strong>Calendar ID:</strong> {ghlCalendarData.calendarId}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : calendarSource === 'google' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Define the types of appointments customers can book.
                  </p>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddAppointmentType}
                    className="flex items-center gap-1"
                  >
                    <Icon name="plus" className="h-3 w-3" />
                    Add Type
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {appointmentTypes.map((type, index) => (
                    <Card key={index} className="border border-border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`type-name-${index}`}>Name</Label>
                                <Input
                                  id={`type-name-${index}`}
                                  value={type.name}
                                  onChange={(e) => handleUpdateAppointmentType(index, 'name', e.target.value)}
                                  placeholder="e.g., Consultation"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor={`type-duration-${index}`}>Duration (minutes)</Label>
                                <Input
                                  id={`type-duration-${index}`}
                                  type="number"
                                  value={type.duration}
                                  onChange={(e) => handleUpdateAppointmentType(index, 'duration', parseInt(e.target.value))}
                                  min={5}
                                  step={5}
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`type-description-${index}`}>Description (Optional)</Label>
                              <Textarea
                                id={`type-description-${index}`}
                                value={type.description || ''}
                                onChange={(e) => handleUpdateAppointmentType(index, 'description', e.target.value)}
                                placeholder="Describe this appointment type"
                                className="min-h-[80px] resize-none"
                              />
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAppointmentType(index)}
                            disabled={appointmentTypes.length <= 1}
                            className="text-muted-foreground hover:text-red-500 ml-4"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {calendarSource === 'calcom' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Select existing event types from your Cal.com account.
                  </p>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCalcomEvents}
                    disabled={fetchingEvents}
                    className="flex items-center gap-1"
                  >
                    {fetchingEvents ? (
                      <>
                        <Icon name="loader2" className="h-3 w-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Icon name="refresh-cw" className="h-3 w-3" />
                        Refresh Events
                      </>
                    )}
                  </Button>
                </div>
            
                {calcomEvents.length === 0 ? (
                  <div className="text-center py-8 bg-muted rounded-lg border border-dashed border-border">
                    <Icon name="calendar" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Event Types Found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      Please create event types from your Cal.com dashboard and refresh the page.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://app.cal.com/event-types', '_blank')}
                      className="flex items-center gap-2 mx-auto"
                    >
                      <Icon name="external-link" className="h-4 w-4" />
                      Go to Cal.com Dashboard
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground mb-3">
                   Below are the events from your Cal.com account.
                    </div>
                    
                    {calcomEvents.map((event) => (
                      <Card key={event.id} className="border border-border">
                        <CardContent className="pt-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`event-${event.id}`}
                              checked={selectedCalcomEvents.includes(String(event.id))}
                              onCheckedChange={(checked: boolean | 'indeterminate') => 
                                handleCalcomEventSelection(String(event.id), checked === true)
                              }
                              className="flex-shrink-0"
                            />
                            
                            <div className="flex-1 space-y-2">
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</Label>
                                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                                </div>
                                
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</Label>
                                  <p className="text-sm text-foreground">{event.lengthInMinutes} minutes</p>
                                </div>
                                
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
                                  <p className="text-sm text-foreground">{event.description || 'No description'}</p>
                                </div>
                              </div>
                              
                              {/* <div className="text-xs text-gray-500">
                                Event ID: {event.id} • Slug: {event.slug}
                              </div> */}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {selectedCalcomEvents.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <Icon name="circle-check" className="h-4 w-4 inline mr-1" />
                          {selectedCalcomEvents.length} event type{selectedCalcomEvents.length !== 1 ? 's' : ''} selected
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        );
        
      default:
        return null;
    }
  };
  
  const renderFooterButtons = () => (
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={onClose}
      >
        Cancel
      </Button>
      
      <div className="flex gap-2">
        {currentStep > 1 && (
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => prev - 1)}
          >
            Previous
          </Button>
        )}
        
        {currentStep < 3 ? (
          <Button
            onClick={() => setCurrentStep(prev => prev + 1)}
            disabled={
              (currentStep === 1 && !name) ||
              (currentStep === 1 && calendarSource === 'google' && !selectedCalendarId) ||
              (currentStep === 1 && calendarSource === 'calcom' && !calcomApiKey) ||
              (currentStep === 3 && calendarSource === 'calcom' && selectedCalcomEvents.length === 0)
            }
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleCreateTool}
            disabled={loading ||
              (calendarSource === 'google' && appointmentTypes.length === 0) ||
              (calendarSource === 'calcom' && selectedCalcomEvents.length === 0) ||
              (calendarSource === 'ghl' && !ghlCalendarData)
            }
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
          >
            {loading ? (
              <>
                <Icon name="spinner" className="mr-2 h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              'Create Tool'
            )}
          </Button>
        )}
      </div>
    </div>
  );
  
  return (
    <div className="h-full flex flex-col bg-muted/50">
      <CalcomConnectionModal
        isOpen={isCalcomModalOpen}
        onClose={() => setIsCalcomModalOpen(false)}
        onConnect={async (apiKey) => {
          console.log("----final api key is after connection", apiKey)
            setIsCalcomModalOpen(false);
            if(session?.user?.id) {
                setIsCheckingCalcom(true);
                checkCalcomCredentials(session.user.id);
                await fetchUserInfo(apiKey);
                await fetchCalcomEvents();

            }
        }}
      />
      <div className="px-8 py-6 bg-background border-b">
        <div className="flex items-center justify-between max-w-6xl mx-auto w-full">
          <h1 className="text-2xl font-semibold">Create Appointment Tool</h1>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="x" className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="mt-8 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </div>
              <div>
                <p className="font-medium">Basic Details</p>
                <p className="text-sm text-muted-foreground">Setup calendar and tool info</p>
              </div>
            </div>
            
            <div className="h-1 w-24 bg-muted">
              <div className={`h-full transition-all ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                2
              </div>
              <div>
                <p className="font-medium">Business Hours</p>
                <p className="text-sm text-muted-foreground">Set your availability</p>
              </div>
            </div>
            
            <div className="h-1 w-24 bg-muted">
              <div className={`h-full transition-all ${currentStep >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                3
              </div>
              <div>
                <p className="font-medium">Appointment Types</p>
                <p className="text-sm text-muted-foreground">Define booking options</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl mx-auto w-full">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">
                {currentStep === 1 && "Basic Details"}
                {currentStep === 2 && (calendarSource === 'ghl' ? "Calendar & Staff Setup" : "Business Hours")}
                {currentStep === 3 && (
                  calendarSource === 'ghl' ? "Review Configuration" :
                  calendarSource === 'google' ? "Appointment Types" : "Event Types"
                )}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 && "Provide basic information about your appointment tool"}
                {currentStep === 2 && (
                  calendarSource === 'ghl' ? "Select your GoHighLevel calendar and assign a staff member" :
                  "Set your availability for appointments"
                )}
                {currentStep === 3 && (
                  calendarSource === 'ghl' ? "Review your appointment tool configuration before creating" :
                  calendarSource === 'google' ? "Define the types of appointments customers can book" : ""
                )}
              </CardDescription>
            </CardHeader>
            
            {renderStepContent()}
            
            {!(calendarSource === 'ghl' && currentStep === 2 && ghlConnection.isConnected) && (
              <CardFooter className="flex justify-between pt-6 border-t mt-6">
                {renderFooterButtons()}
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
} 