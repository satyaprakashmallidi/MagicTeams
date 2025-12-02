import { format, parse, formatISO } from "date-fns";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";

const TIMEZONE_MAPPINGS: Record<string, string> = {
  EST: "America/New_York",
  EDT: "America/New_York",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  GMT: "Etc/GMT",
  UTC: "Etc/UTC",
  IST: "Asia/Kolkata", // Indian Standard Time
  JST: "Asia/Tokyo", // Japan Standard Time
  AEST: "Australia/Sydney", // Australian Eastern Standard Time
  ACST: "Australia/Adelaide", // Australian Central Standard Time
  AWST: "Australia/Perth", // Australian Western Standard Time
};

/**
 * Normalize timezone string to IANA timezone identifier
 * @param timezone User provided timezone string
 * @returns IANA timezone identifier
 */
export function normalizeTimezone(timezone: string): string {
  if (TIMEZONE_MAPPINGS[timezone.toUpperCase()]) {
    return TIMEZONE_MAPPINGS[timezone.toUpperCase()];
  }

  if (
    timezone.toLowerCase().includes("indian standard time") ||
    timezone.toLowerCase().includes("india standard time") ||
    timezone.toLowerCase() === "india"
  ) {
    return "Asia/Kolkata";
  }

  if (/^GMT[+-]\d{1,2}$/.test(timezone)) {
    const offset = timezone.substring(3);
    return `Etc/GMT${offset.startsWith("+") ? "-" : "+"}${offset.substring(1)}`; // Etc/GMT uses inverted sign
  }

  if (/^IST[+-]5:30$/.test(timezone)) {
    return "Asia/Kolkata";
  }

  if (/^[+-]\d{1,2}$/.test(timezone)) {
    return `Etc/GMT${timezone.startsWith("+") ? "-" : "+"}${timezone.substring(
      1
    )}`; // Etc/GMT uses inverted sign
  }

  if (timezone.includes("/")) {
    return timezone;
  }

  console.warn(`Could not parse timezone: ${timezone}, defaulting to UTC`);
  return "Etc/UTC";
}

/**
 * Convert a date and time from one timezone to another
 * @param dateString Date string in YYYY-MM-DD format
 * @param timeString Time string in HH:MM format
 * @param fromTimezone Source timezone
 * @param toTimezone Target timezone (defaults to UTC)
 * @returns Object with converted date and time strings
 */
export function convertTimezone(
  dateString: string,
  timeString: string,
  fromTimezone: string,
  toTimezone: string = "UTC"
): { date: string; time: string } {
  try {
    console.log(
      `Converting time: ${dateString} ${timeString} from timezone "${fromTimezone}" to "${toTimezone}"`
    );

    const normalizedFromTz = normalizeTimezone(fromTimezone);
    const normalizedToTz = normalizeTimezone(toTimezone);

    console.log(
      `Normalized timezones: "${fromTimezone}" -> "${normalizedFromTz}", "${toTimezone}" -> "${normalizedToTz}"`
    );

    const dateTime = parse(
      `${dateString} ${timeString}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );

    if (isNaN(dateTime.getTime())) {
      throw new Error(
        `Invalid date or time format: ${dateString} ${timeString}`
      );
    }

    const utcDateTime = zonedTimeToUtc(dateTime, normalizedFromTz);

    const targetDateTime = utcToZonedTime(utcDateTime, normalizedToTz);

    const resultDate = format(targetDateTime, "yyyy-MM-dd");
    const resultTime = format(targetDateTime, "HH:mm");

    console.log(
      `Conversion result: ${dateString} ${timeString} (${normalizedFromTz}) -> ${resultDate} ${resultTime} (${normalizedToTz})`
    );

    return { date: resultDate, time: resultTime };
  } catch (error) {
    console.error("Error converting timezone:", error);
    console.error(
      `Failed to convert ${dateString} ${timeString} from ${fromTimezone} to ${toTimezone}`
    );
    return { date: dateString, time: timeString };
  }
}

/**
 * Detect user's timezone from browser
 * This can be used on the client side to get the user's local timezone
 * @returns IANA timezone identifier
 */
export function detectBrowserTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "Etc/UTC"; // Default to UTC if detection fails
}

/**
 * Get a list of all IANA timezone identifiers for a specific region
 * @param region Region code (e.g., 'America', 'Europe')
 * @returns Array of timezone identifiers
 */
export function getTimezonesForRegion(region: string): string[] {
  switch (region) {
    case "America":
      return [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Toronto",
        "America/Mexico_City",
      ];
    case "Europe":
      return [
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Madrid",
        "Europe/Rome",
      ];
    case "Asia":
      return [
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Singapore",
        "Asia/Dubai",
        "Asia/Kolkata",
      ];
    default:
      return ["Etc/UTC"];
  }
}

export function getUtcIsoStringFromLocalInput(
  dateString: string,
  timeString: string,
  timezone: string
): string {
  try {
    const tz = normalizeTimezone(timezone);
    let timeRaw = timeString.trim().toUpperCase().replace(/\s+/g, "");

    // Handle various time formats
    if (/^\d{1,2}[AP]M$/.test(timeRaw)) {
      timeRaw = timeRaw.replace(/^(\d{1,2})([AP]M)$/, "$1:00$2");
    }

    if (/^\d{1,2}:\d{1,2}[AP]M$/.test(timeRaw)) {
      timeRaw = timeRaw.replace(
        /^(\d{1,2}):(\d{1})([AP]M)$/,
        (_, h, m, ampm) => `${h}:${m.padStart(2, "0")}${ampm}`
      );
    }

    if (/^\d{3,4}[AP]M$/.test(timeRaw)) {
      const match = timeRaw.match(/^(\d{1,2})(\d{2})([AP]M)$/);
      if (match) {
        timeRaw = `${parseInt(match[1], 10)}:${match[2]}${match[3]}`;
      }
    }

    // Build the datetime string in the format that toZonedTime expects
    const is12Hour = timeRaw.includes("AM") || timeRaw.includes("PM");

    // Convert to 24-hour format if needed
    let hour24, minute;
    if (is12Hour) {
      const match = timeRaw.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
      if (!match) {
        throw new Error(`Invalid time format: ${timeRaw}`);
      }
      let hour = parseInt(match[1], 10);
      minute = match[2];
      const isPM = match[3] === 'PM';

      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
      hour24 = hour.toString().padStart(2, '0');
    } else {
      const match = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) {
        throw new Error(`Invalid time format: ${timeRaw}`);
      }
      hour24 = match[1].padStart(2, '0');
      minute = match[2];
    }

    // Use the SAME logic as convertTimezone function above - it works!
    // Parse the date/time string, then use zonedTimeToUtc to interpret it as being in the target timezone

    const dateTimeStr = `${dateString} ${hour24}:${minute}`;

    // Parse the date string - this creates a Date object in the browser's local timezone
    // where getHours() and getMinutes() will return our input values
    const localDate = parse(dateTimeStr, 'yyyy-MM-dd HH:mm', new Date());

    if (isNaN(localDate.getTime())) {
      throw new Error(`Unable to parse datetime: ${dateTimeStr}`);
    }

    // Now convert: zonedTimeToUtc interprets the localDate's wall clock time
    // (the values returned by getHours(), getMinutes()) as being in the target timezone,
    // and converts it to UTC
    const utcDate = zonedTimeToUtc(localDate, tz);

    return utcDate.toISOString();
  } catch (error: any) {
    console.error(
      `Error converting "${dateString} ${timeString}" (${timezone}):`,
      error?.message || error
    );
    throw new Error("Invalid date, time, or timezone input");
  }
}
