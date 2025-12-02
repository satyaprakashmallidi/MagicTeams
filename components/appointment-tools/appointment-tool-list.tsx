import { Icon } from '@/components/ui/icons';
import { useUser } from '@/hooks/use-user';
import { useAppointmentTools } from '@/hooks/use-appointments';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppointmentsToolsStore } from '@/store/use-appointments-store';

interface AppointmentToolListProps {
  onSelectTool: (toolId: string) => void;
  selectedToolId: string | null;
}

export function AppointmentToolList({ onSelectTool, selectedToolId }: AppointmentToolListProps) {
  
  const { user } = useUser();
  const {  tools } = useAppointmentTools();
  const { toast } = useToast();
  const setTools = useAppointmentsToolsStore((state) => state.setTools);

  const handleDeleteTool = async (toolId: string) => {
    try {
      const { error } = await supabase
        .from('appointment_tools')
        .update({ is_deleted: true })
        .eq('id', toolId);

      if (error) throw error;

      toast({
        title: "Tool deleted",
        description: "The appointment tool has been successfully deleted.",
      });

      // Update local state
      setTools(tools.filter(tool => tool.id !== toolId));

      // If the deleted tool was selected, clear selection
      if (selectedToolId === toolId) {
        onSelectTool('');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the appointment tool. Please try again.",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="space-y-2">
      {tools.filter(tool => !tool.is_deleted).map((tool) => (
        <div
          key={tool.id}
          onClick={() => onSelectTool(tool.id)}
          className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer ${
            selectedToolId === tool.id ? 'bg-accent border-border shadow-sm' : 'bg-background border-border hover:border-border/80'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedToolId === tool.id ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Icon name="calendar" className={`h-5 w-5 ${
                    selectedToolId === tool.id ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{tool.name}</h3>
                {tool.description && (
                  <p className="text-sm text-muted-foreground truncate">{tool.description}</p>
                )}
              </div>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-800 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Appointment Tool</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this appointment tool? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteTool(tool.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
      
      {tools.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Icon name="calendar" className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No appointment tools found. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
