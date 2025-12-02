import { supabase } from "@/lib/supabase";
import { AppointmentTool } from "@/lib/types/appointment";
import { create } from "zustand";

interface AppointmentTools {

    //initial state
    tools: AppointmentTool[] ;

    //basic functions
    setTools: (tools: AppointmentTool[]) => void;


    fetchAppointmentsTools: () => Promise<AppointmentTool[]>;
}

export const useAppointmentsToolsStore = create<AppointmentTools>((set) => ({

    //initial state
    tools: [] as AppointmentTool[],

    //basic functions
    setTools: (tools: AppointmentTool []) => set({ tools }),

    fetchAppointmentsTools: async () => {
        const { data, error } = await supabase
            .from("appointment_tools")
            .select("*")
            .eq("user_id", (await supabase.auth.getUser()).data?.user?.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error('Error fetching appointment tools:', error);
        } else {
            set({ tools: data as AppointmentTool[] });
        }

        return data as AppointmentTool[];
    }

}))