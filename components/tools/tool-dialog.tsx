import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const ReactJson = dynamic(() => import("react-json-view"), { ssr: false });

interface Tool {
  toolId?: string;
  name: string;
  definition: any;
}

type Mode = "view" | "edit" | "create";

const fieldExplanations: Record<string, string> = {
  name: "A unique name for your tool.",
  definition: "The full JSON definition of your tool. You can edit, add, or remove fields interactively.",
};

export default function ToolDialog({ open, mode, tool, onClose, onSave }: {
  open: boolean;
  mode: Mode;
  tool?: Tool;
  onClose: () => void;
  onSave: (tool: Tool) => void;
}) {
  const [name, setName] = useState(tool?.name || "");
  const [definition, setDefinition] = useState<any>(tool?.definition || {
    modelToolName: "",
    description: "",
    dynamicParameters: [],
    staticParameters: [],
    http: {},
    timeout: "20s",
    precomputable: false,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isView = mode === "view";

  const handleJsonChange = (edit: any) => {
    setDefinition(edit.updated_src);
    setIsDirty(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
  };

  const handleSave = () => {
    try {
      // Validate JSON by stringifying
      JSON.stringify(definition);
      onSave({ ...tool, name, definition });
      setIsDirty(false);
    } catch (e) {
      setError("Invalid JSON structure");
    }
  };

  const handleDiscard = () => {
    setName(tool?.name || "");
    setDefinition(tool?.definition || {
      modelToolName: "",
      description: "",
      dynamicParameters: [],
      staticParameters: [],
      http: {},
      timeout: "20s",
      precomputable: false,
    });
    setIsDirty(false);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <Card className="w-full max-w-2xl mx-auto shadow-2xl">
        <CardHeader>
          <CardTitle>
            {mode === "create" && "Create Tool"}
            {mode === "edit" && "Edit Tool"}
            {mode === "view" && "View Tool"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="font-medium flex items-center gap-2">
                Name
                <span className="text-xs text-muted-foreground" title={fieldExplanations.name}>?</span>
              </label>
              <input
                className="w-full border rounded px-3 py-2 mt-1"
                value={name}
                onChange={handleNameChange}
                disabled={isView}
                placeholder="Tool Name"
              />
            </div>
            <div>
              <label className="font-medium flex items-center gap-2">
                Tool Definition (JSON)
                <span className="text-xs text-muted-foreground" title={fieldExplanations.definition}>?</span>
              </label>
              <div className="mt-2">
                <ReactJson
                  src={definition}
                  onEdit={isView ? false : handleJsonChange}
                  onAdd={isView ? false : handleJsonChange}
                  onDelete={isView ? false : handleJsonChange}
                  enableClipboard={true}
                  displayDataTypes={false}
                  displayObjectSize={false}
                  collapsed={2}
                  name={null}
                  theme="rjv-default"
                  style={{ fontSize: 12 }}
                />
              </div>
              {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleDiscard}>Discard</Button>
          {!isView && (
            <Button onClick={handleSave} disabled={!isDirty}>Save Changes</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 