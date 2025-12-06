import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParameterLocation } from "@/lib/types";
import ToolForm from "./tool-form";

interface Tool {
  toolId?: string;
  name: string;
  definition: any;
}

type Mode = "view" | "edit" | "create";

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const createDefaultDefinition = () => ({
  modelToolName: "",
  description: "",
  dynamicParameters: [],
  staticParameters: [],
  http: {
    baseUrlPattern: "",
    httpMethod: "GET",
  },
  timeout: "20s",
  precomputable: false,
});

export default function ToolDialog({ open, mode, tool, onClose, onSave }: {
  open: boolean;
  mode: Mode;
  tool?: Tool;
  onClose: () => void;
  onSave: (tool: Tool) => void;
}) {
  const [name, setName] = useState(tool?.name || "");
  const [definition, setDefinition] = useState<any>(tool?.definition || createDefaultDefinition());
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaDrafts, setSchemaDrafts] = useState<Record<string, string>>({});
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});
  const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({});

  const isView = mode === "view";

  useEffect(() => {
    if (!open) return;
    setName(tool?.name || "");
    setDefinition(tool?.definition || createDefaultDefinition());
    setSchemaDrafts({});
    setValueDrafts({});
    setParameterErrors({});
    setIsDirty(false);
    setError(null);
  }, [open, tool, mode]);

  const setDefinitionWithDirty = (updater: ((prev: any) => any) | any) => {
    setDefinition((prev: any) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setIsDirty(true);
    setError(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
  };

  const handleSave = () => {
    try {
      const validationMessage = validateDefinition();
      if (validationMessage) {
        setError(validationMessage);
        return;
      }
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
    setDefinition(tool?.definition || createDefaultDefinition());
    setSchemaDrafts({});
    setValueDrafts({});
    setParameterErrors({});
    setIsDirty(false);
    setError(null);
    onClose();
  };

  const handleSimpleFieldChange = (field: string, value: any) => {
    setDefinitionWithDirty((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleHttpChange = (field: string, value: any) => {
    setDefinitionWithDirty((prev: any) => ({
      ...prev,
      http: {
        ...(prev.http || { baseUrlPattern: "", httpMethod: "GET" }),
        [field]: value,
      },
    }));
  };

  const handleDynamicParameterChange = (index: number, field: string, value: any) => {
    setDefinitionWithDirty((prev: any) => {
      const params = [...(prev.dynamicParameters || [])];
      params[index] = { ...params[index], [field]: value };
      return { ...prev, dynamicParameters: params };
    });
  };

  const handleStaticParameterChange = (index: number, field: string, value: any) => {
    setDefinitionWithDirty((prev: any) => {
      const params = [...(prev.staticParameters || [])];
      params[index] = { ...params[index], [field]: value };
      return { ...prev, staticParameters: params };
    });
  };

  const addDynamicParameter = () => {
    if (isView) return;
    setDefinitionWithDirty((prev: any) => ({
      ...prev,
      dynamicParameters: [
        ...(prev.dynamicParameters || []),
        { name: "", location: ParameterLocation.BODY, required: false, schema: {} },
      ],
    }));
  };

  const addStaticParameter = () => {
    if (isView) return;
    setDefinitionWithDirty((prev: any) => ({
      ...prev,
      staticParameters: [
        ...(prev.staticParameters || []),
        { name: "", location: ParameterLocation.BODY, value: "" },
      ],
    }));
  };

  const removeParameter = (type: "dynamic" | "static", index: number) => {
    if (isView) return;
    setDefinitionWithDirty((prev: any) => {
      const key = type === "dynamic" ? "dynamicParameters" : "staticParameters";
      const params = [...(prev[key] || [])];
      params.splice(index, 1);
      return { ...prev, [key]: params };
    });
  };

  const handleSchemaDraftChange = (key: string, value: string) => {
    setSchemaDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const handleDynamicSchemaBlur = (index: number) => {
    const key = `dynamic-${index}-schema`;
    const raw = schemaDrafts[key];
    if (raw === undefined) return;
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      handleDynamicParameterChange(index, "schema", parsed);
      setSchemaDrafts((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      setParameterErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } catch (err) {
      setParameterErrors((prev) => ({ ...prev, [key]: "Invalid JSON" }));
    }
  };

  const handleStaticValueBlur = (index: number) => {
    const key = `static-${index}-value`;
    const raw = valueDrafts[key];
    if (raw === undefined) return;
    let parsed: any = raw;
    try {
      parsed = raw ? JSON.parse(raw) : "";
    } catch (err) {
      parsed = raw;
    }
    handleStaticParameterChange(index, "value", parsed);
    setValueDrafts((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const validateDefinition = (): string | null => {
    if (!name.trim()) return "Tool name is required.";
    if (!TOOL_NAME_PATTERN.test(name.trim())) {
      return "Name must be 1-64 characters and only contain letters, numbers, underscores, or dashes.";
    }
    if (!definition?.modelToolName?.trim()) return "Model tool name is required.";
    if (!definition?.description?.trim()) return "Description is required.";
    if (!definition?.timeout?.trim()) return "Timeout is required.";
    const http = definition?.http || {};
    if (!http.baseUrlPattern?.trim()) return "HTTP base URL pattern is required.";
    if (!http.httpMethod?.trim()) return "HTTP method is required.";

    const dynamic = definition?.dynamicParameters || [];
    for (let i = 0; i < dynamic.length; i++) {
      const param = dynamic[i];
      if (!param?.name?.trim()) return `Dynamic parameter ${i + 1} is missing a name.`;
      if (!param?.location) return `Dynamic parameter ${i + 1} must have a location.`;
      if (!param?.schema || Object.keys(param.schema).length === 0) {
        return `Dynamic parameter ${i + 1} must include a schema.`;
      }
    }

    const staticParams = definition?.staticParameters || [];
    for (let i = 0; i < staticParams.length; i++) {
      const param = staticParams[i];
      if (!param?.name?.trim()) return `Static parameter ${i + 1} is missing a name.`;
      if (!param?.location) return `Static parameter ${i + 1} must have a location.`;
      if (param?.value === undefined || param?.value === "") {
        return `Static parameter ${i + 1} must include a value.`;
      }
    }

    return null;
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
        <ToolForm
            name={name}
            definition={definition}
            isView={isView}
            handleNameChange={handleNameChange}
            handleSimpleFieldChange={handleSimpleFieldChange}
            handleHttpChange={handleHttpChange}
            handleDynamicParameterChange={handleDynamicParameterChange}
            handleStaticParameterChange={handleStaticParameterChange}
            addDynamicParameter={addDynamicParameter}
            addStaticParameter={addStaticParameter}
            removeParameter={removeParameter}
            schemaDrafts={schemaDrafts}
            handleSchemaDraftChange={handleSchemaDraftChange}
            handleDynamicSchemaBlur={handleDynamicSchemaBlur}
            parameterErrors={parameterErrors}
            valueDrafts={valueDrafts}
            setValueDrafts={setValueDrafts}
            handleStaticValueBlur={handleStaticValueBlur}
          />
          {error && <div className="text-red-500 text-sm">{error}</div>}
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
