import { Bot } from './types';

interface AppointmentSystemPrompt {
  businessHours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
  appointmentTypes: {
    consultation: string;
    followUp: string;
    general: string;
    urgent: string;
  };
}

const parseSystemPrompt = (
  template: string,
  bot: Bot,
  currentDate: Date = new Date()
): string => {
  // Parse business hours from bot configuration
  const businessHours = {
    weekdays: `${bot.hours?.start || '9:00 AM'} - ${bot.hours?.end || '5:00 PM'}`,
    saturday: bot.days?.includes('saturday') 
      ? `${bot.hours?.start || '10:00 AM'} - ${bot.hours?.end || '2:00 PM'}`
      : 'Closed',
    sunday: bot.days?.includes('sunday')
      ? `${bot.hours?.start || 'Closed'} - ${bot.hours?.end || ''}`
      : 'Closed'
  };

  // Replace dynamic values in template
  let parsedPrompt = template
    .replace('${new Date()}', currentDate.toISOString())
    .replace(
      'Monday - Friday: 9:00 AM - 5:00 PM',
      `Monday - Friday: ${businessHours.weekdays}`
    )
    .replace(
      'Saturday: 10:00 AM - 2:00 PM',
      `Saturday: ${businessHours.saturday}`
    )
    .replace(
      'Sunday: Closed',
      `Sunday: ${businessHours.sunday}`
    );

  return parsedPrompt;
};

export { parseSystemPrompt, type AppointmentSystemPrompt };
