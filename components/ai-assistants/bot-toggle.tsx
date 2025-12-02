
"use client";

import { Badge } from "@/components/ui/badge";
import { Bot } from "@/types/database";

interface BotToggleProps {
    bot: Bot;
}

export function BotToggle({ bot }: BotToggleProps) {
    const isActive = bot.is_enabled !== false;

    return (
        <Badge
            variant={isActive ? "default" : "destructive"}
            className={isActive ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
        >
            {isActive ? "Active" : "Inactive"}
        </Badge>
    );
}
