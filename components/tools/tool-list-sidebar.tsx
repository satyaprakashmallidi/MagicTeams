import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

interface Tool {
  toolId: string;
  name: string;
  definition: any;
}

export default function ToolListSidebar({
  tools,
  selectedToolId,
  onSelect,
  onDelete,
  onCreate,
}: {
  tools: Tool[];
  selectedToolId: string | null;
  onSelect: (toolId: string) => void;
  onDelete: (toolId: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card className="w-64 bg-background overflow-y-auto custom-scrollbar h-full flex flex-col">
      <div className="p-4">
        <Button className="w-full flex items-center gap-2 mb-4" variant="default" onClick={onCreate}>
          <Icon name="plus" className="h-4 w-4" />
          New Tool
        </Button>
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool.toolId}
              className={`p-3 cursor-pointer hover:bg-accent flex justify-between items-center ${
                selectedToolId === tool.toolId ? 'bg-accent' : ''
              }`}
              onClick={() => onSelect(tool.toolId)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon name="settings" className="h-3 w-3" />
                  <h3 className="font-medium max-w-[140px] truncate">{tool.name}</h3>
                </div>
                {/* {tool.definition?.description && (
                  <p className="text-sm text-gray-500">{tool.definition.description}</p>
                )} */}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-800"
                onClick={e => { e.stopPropagation(); onDelete(tool.toolId); }}
              >
                <Icon name="trash" className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {tools.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No tools found. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
} 