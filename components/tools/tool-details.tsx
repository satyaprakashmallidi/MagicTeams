import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const ReactJson = dynamic(() => import("react-json-view"), { ssr: false });

interface Tool {
  toolId: string;
  name: string;
  definition: any;
}

export default function ToolDetails({ tool, onEdit, onSave }: { tool: Tool | null, onEdit?: () => void, onSave?: (tool: Tool) => void }) {
  const [editMode, setEditMode] = useState(false);
  const [localDef, setLocalDef] = useState<any>(tool?.definition || {});
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalDef(tool?.definition || {});
    setIsDirty(false);
    setError(null);
    setEditMode(false);
  }, [tool?.toolId]);

  if (!tool) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a tool to view and edit details
      </div>
    );
  }

  const handleJsonChange = (edit: any) => {
    setLocalDef(edit.updated_src);
    setIsDirty(true);
    setError(null);
  };

  const handleSave = () => {
    try {
      JSON.stringify(localDef);
      onSave && onSave({ ...tool, definition: localDef });
      setIsDirty(false);
      setEditMode(false);
    } catch (e) {
      setError("Invalid JSON structure");
    }
  };

  const handleDiscard = () => {
    setLocalDef(tool.definition);
    setIsDirty(false);
    setError(null);
    setEditMode(false);
  };

  return (
    <Card className="max-w-full mx-auto">
      <CardHeader>
        <CardTitle>{tool.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <style>{`
          .rjv-default .string-value {
            white-space: pre-wrap !important;
            word-break: break-word !important;
          }
        `}</style>
        {/* <div className="mb-4">
          <span className="font-semibold">Description:</span> {tool.definition?.description || "-"}
        </div> */}
        <div>
          <span className="font-semibold">Definition (JSON):</span>
          <div className="mt-2">
            <ReactJson
              src={editMode ? localDef : tool.definition}
              onEdit={editMode ? handleJsonChange : false}
              onAdd={editMode ? handleJsonChange : false}
              onDelete={editMode ? handleJsonChange : false}
              enableClipboard={true}
              displayDataTypes={false}
              displayObjectSize={false}
              collapsed={2}
              name={null}
              theme="rjv-default"
              style={{ fontSize: 12, height: '100%', minWidth: '340px' }}
            />
          </div>
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
      </CardContent>
      <CardFooter>
        {!editMode && (
          <Button onClick={() => setEditMode(true)}>Edit Tool</Button>
        )}
        {editMode && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDiscard}>Discard</Button>
            <Button onClick={handleSave} disabled={!isDirty}>Save Changes</Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 