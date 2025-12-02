import { useWebhookStore } from "@/store/use-webhook-store";
import { useEffect, useRef } from "react";

export function useWebhooks() {
    const { 
        webhooks,
        userWebhooks,
        selectedWebhookId,
        isLoading,
        error,
        setSelectedWebhookId,
        fetchWebhooks,
        fetchUserWebhooks,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        testWebhook,
        clearError
    } = useWebhookStore();

    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchWebhooks();
            // Don't call fetchUserWebhooks here as it's redundant with fetchWebhooks
        }
    }, []);

    return { 
        webhooks,
        userWebhooks,
        selectedWebhookId, 
        isLoading, 
        error,
        setSelectedWebhookId,
        fetchWebhooks,
        fetchUserWebhooks,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        testWebhook,
        clearError
    };
}