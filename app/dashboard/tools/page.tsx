"use client";
import React, { useEffect, useState } from "react";
import ToolListSidebar from "@/components/tools/tool-list-sidebar";
import ToolDetails from "@/components/tools/tool-details";
import ToolDialog from "@/components/tools/tool-dialog";
import { getAllTools, createTool, updateTool, deleteTool } from "@/components/tools/toolsService";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";

export default function ToolsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [tools, setTools] = useState<any[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("view");
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchTools = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await getAllTools(user.id);
      setTools(res.tools?.results || []);
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
    // eslint-disable-next-line
  }, [user?.id]);

  const handleSelect = (toolId: string) => {
    setSelectedToolId(toolId);
    const tool = tools.find(t => t.toolId === toolId) || null;
    setSelectedTool(tool);
  };

  const handleDelete = async (toolId: string) => {
    if (!user?.id) return;
    if (!window.confirm("Are you sure you want to delete this tool?")) return;
    await deleteTool(toolId, user.id);
    toast({ title: "Tool deleted" });
    setSelectedToolId(null);
    setSelectedTool(null);
    fetchTools();
  };

  const handleCreate = () => {
    setDialogMode("create");
    setSelectedTool(null);
    setDialogOpen(true);
  };

  const handleEdit = () => {
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDialogSave = async (tool: any) => {
    try {
      if (!user?.id) return;
      if (dialogMode === "create") {
        await createTool(user.id, "", { name: tool.name, definition: tool.definition });
        toast({ title: "Tool created!" });
      } else if (dialogMode === "edit" && selectedTool?.toolId) {
        await updateTool(selectedTool.toolId, user.id, { name: tool.name, definition: tool.definition });
        toast({ title: "Tool updated!" });
      }
      setDialogOpen(false);
      fetchTools();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="flex h-full">
      <ToolListSidebar
        tools={tools}
        selectedToolId={selectedToolId}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onCreate={handleCreate}
      />
      <div className="flex-1 p-6 bg-muted/50 overflow-y-auto custom-scrollbar">
        <ToolDetails
          tool={selectedTool}
          onSave={async (tool) => {
            if (!user?.id || !tool.toolId) return;
            try {
              await updateTool(tool.toolId, user.id, { name: tool.name, definition: tool.definition });
              toast({ title: "Tool updated!" });
              fetchTools();
              setSelectedTool(tool);
            } catch (e) {
              toast({ title: "Error", description: String(e), variant: "destructive" });
            }
          }}
        />
      </div>
      <ToolDialog
        open={dialogOpen}
        mode={dialogMode}
        tool={dialogMode === "edit" ? selectedTool : undefined}
        onClose={handleDialogClose}
        onSave={handleDialogSave}
      />
    </div>
  );
} 