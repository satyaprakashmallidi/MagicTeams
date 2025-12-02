import { useBotStore } from "@/store/use-bot-store";
import { Bot } from "@/types/database";
import { useEffect } from "react";

export function useBots() {
    const { 
        bots,
        selectedBotId,
        isLoading,
        error,
        fetchBots,
        setSelectedBotId,
        addBot,
        updateBot,
        deleteBot,
        duplicateBot
    } = useBotStore();

    useEffect(() => {
        fetchBots();
    }, []);

    return { 
        bots, 
        selectedBotId, 
        isLoading, 
        error,
        setSelectedBotId,
        addBot,
        updateBot,
        deleteBot,
        duplicateBot
    };
}