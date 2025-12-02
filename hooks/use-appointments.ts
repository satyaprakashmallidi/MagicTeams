import { useAppointmentsToolsStore } from "@/store/use-appointments-store";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect } from "react";

export const useAppointmentTools = () => {

    const appointmentTools = useAppointmentsToolsStore((state) => state.tools);

    const fetchAppointmentsTools = useCallback(async () => {

        if(appointmentTools && appointmentTools.length > 0) return;

        try {

        const { data, error } = await supabase
            .from("appointment_tools")
            .select("*")
            .eq("user_id", (await supabase.auth.getUser()).data?.user?.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching appointment tools:", error);
        } 

        if(data) useAppointmentsToolsStore.getState().setTools(data);

        }
        catch (error) {
            console.error("Error fetching appointment tools:", error);
        }


    } , []);

    useEffect(() => {
        fetchAppointmentsTools();
    },[]);

    return {
        tools : appointmentTools,
    };
};