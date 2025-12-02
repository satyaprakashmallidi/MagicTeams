import { cn } from '@/lib/utils';

export const calendarStyles = {
  calendar: "h-full w-full font-sans text-sm",
  toolbar: "flex flex-wrap items-center justify-between gap-4 p-4 border-b border-border",
  toolbarLabel: "text-lg font-medium text-foreground",
  btnGroup: "flex items-center gap-1",
  btn: "px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors",
  btnActive: "bg-primary text-primary-foreground hover:bg-primary/90",
  header: "p-2 text-center border-b border-r border-border font-medium text-muted-foreground",
  headerAdjacent: "border-l-0",
  dayBgAdjacent: "border-l-0",
  offRangeBg: "bg-muted/50",
  dateCell: "p-1 text-right text-sm text-muted-foreground",
  dateCellNow: "font-bold text-primary",
  event: "bg-primary text-primary-foreground rounded px-2 py-1 text-sm",
  eventSelected: "bg-primary/90",
  eventContent: "font-medium",
  showMore: "text-sm text-primary hover:text-primary/90 hover:underline",
  monthView: "border border-border rounded-lg bg-card text-card-foreground",
  monthRowAdjacent: "border-t-0",
  dayBg: "border-r border-b border-border",
  overlay: "bg-popover text-popover-foreground rounded-lg shadow-lg border border-border p-2",
  overlayHeader: "text-sm font-medium border-b border-border pb-2 mb-2",
  agendaView: "h-[500px] overflow-y-auto",
  scrollbar: {
    track: "rounded bg-[hsl(var(--scrollbar-track))]",
    thumb: "rounded bg-[hsl(var(--scrollbar-thumb))] hover:bg-[hsl(var(--scrollbar-thumb-hover))]",
    width: "w-2"
  },
  agendaTable: "w-full border-collapse",
  agendaCell: "border border-border p-2 text-sm",
  agendaTimeCell: "text-muted-foreground",
  agendaEventCell: "text-foreground",
  timeView: "border border-border rounded-lg bg-card text-card-foreground",
  timeHeader: "border-b border-border",
  timeContent: "h-[500px] overflow-y-auto",
  timeslotGroup: "border-b border-border",
  timeSlot: "text-xs text-muted-foreground",
  currentTimeIndicator: "bg-primary h-0.5"
};

export function getCalendarClassName(key: keyof typeof calendarStyles, ...additionalClasses: string[]) {
  const baseClass = calendarStyles[key];
  return cn(baseClass, ...additionalClasses);
}
