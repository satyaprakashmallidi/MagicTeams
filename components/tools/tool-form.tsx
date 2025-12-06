import React from "react";
import { ParameterLocation } from "@/lib/types";
import { Button } from "@/components/ui/button";

const parameterLocations = Object.values(ParameterLocation);
const parameterLocationLabels: Record<ParameterLocation, string> = {
  [ParameterLocation.UNSPECIFIED]: "Unspecified",
  [ParameterLocation.QUERY]: "Query",
  [ParameterLocation.PATH]: "Path",
  [ParameterLocation.HEADER]: "Header",
  [ParameterLocation.BODY]: "Body",
};

const fieldExplanations: Record<string, string> = {
    name: "A unique name for your tool.",
    definition: "Configure the tool definition using custom fields.",
  };

const renderSchemaValue = (value: any) => {
if (value === undefined || value === null) return "";
return JSON.stringify(value, null, 2);
};

const renderStaticValue = (value: any) => {
if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
}
if (value === undefined || value === null) return "";
return JSON.stringify(value, null, 2);
};

export default function ToolForm({
  name,
  definition,
  isView,
  handleNameChange,
  handleSimpleFieldChange,
  handleHttpChange,
  handleDynamicParameterChange,
  handleStaticParameterChange,
  addDynamicParameter,
  addStaticParameter,
  removeParameter,
  schemaDrafts,
  handleSchemaDraftChange,
  handleDynamicSchemaBlur,
  parameterErrors,
  valueDrafts,
  setValueDrafts,
  handleStaticValueBlur
}: {
  name: string;
  definition: any;
  isView: boolean;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSimpleFieldChange: (field: string, value: any) => void;
  handleHttpChange: (field: string, value: any) => void;
  handleDynamicParameterChange: (index: number, field: string, value: any) => void;
  handleStaticParameterChange: (index: number, field: string, value: any) => void;
  addDynamicParameter: () => void;
  addStaticParameter: () => void;
  removeParameter: (type: "dynamic" | "static", index: number) => void;
  schemaDrafts: Record<string, string>;
  handleSchemaDraftChange: (key: string, value: string) => void;
  handleDynamicSchemaBlur: (index: number) => void;
  parameterErrors: Record<string, string>;
  valueDrafts: Record<string, string>;
  setValueDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleStaticValueBlur: (index: number) => void;
}) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="font-medium">Model Tool Name</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={definition.modelToolName || ""}
            onChange={(e) => handleSimpleFieldChange("modelToolName", e.target.value)}
            disabled={isView}
            placeholder="ex: getWeather"
          />
        </div>
        <div>
          <label className="font-medium">Timeout</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={definition.timeout || ""}
            onChange={(e) => handleSimpleFieldChange("timeout", e.target.value)}
            disabled={isView}
            placeholder="20s"
          />
        </div>
      </div>

      <div>
        <label className="font-medium flex items-center gap-2">
          Description
          <span className="text-xs text-muted-foreground" title={fieldExplanations.definition}>?</span>
        </label>
        <textarea
          className="w-full border rounded px-3 py-2 mt-1 min-h-[80px]"
          value={definition.description || ""}
          onChange={(e) => handleSimpleFieldChange("description", e.target.value)}
          disabled={isView}
          placeholder="What this tool does and how it should be used"
        />
      </div>

      <div className="border rounded-md p-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Dynamic Parameters</p>
            <p className="text-xs text-muted-foreground">Parameters provided at runtime</p>
          </div>
          {!isView && (
            <Button size="sm" variant="secondary" onClick={addDynamicParameter}>+ Add</Button>
          )}
        </div>
        {(definition.dynamicParameters || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No dynamic parameters defined.</p>
        )}
        {(definition.dynamicParameters || []).map((param: any, index: number) => {
          const schemaKey = `dynamic-${index}-schema`;
          return (
            <div key={index} className="rounded-md border p-3 space-y-3 bg-muted/40">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Parameter {index + 1}</p>
                {!isView && (
                  <Button size="sm" variant="ghost" onClick={() => removeParameter("dynamic", index)}>Remove</Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={param?.name || ""}
                    onChange={(e) => handleDynamicParameterChange(index, "name", e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <select
                    className="w-full border rounded px-3 py-2 mt-1 bg-background"
                    value={param?.location || ParameterLocation.BODY}
                    onChange={(e) => handleDynamicParameterChange(index, "location", e.target.value)}
                    disabled={isView}
                  >
                    {parameterLocations.map((location) => (
                      <option key={location} value={location}>
                        {parameterLocationLabels[location as ParameterLocation] || location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(param?.required)}
                  onChange={(e) => handleDynamicParameterChange(index, "required", e.target.checked)}
                  disabled={isView}
                />
                Required
              </label>
              <div>
                <label className="text-sm font-medium">Schema (JSON)</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1 min-h-[80px] resize-none"
                  value={schemaDrafts[schemaKey] ?? renderSchemaValue(param?.schema)}
                  onChange={(e) => handleSchemaDraftChange(schemaKey, e.target.value)}
                  onBlur={() => handleDynamicSchemaBlur(index)}
                  disabled={isView}
                  placeholder='{"type":"object"}'
                />
                {parameterErrors[schemaKey] && (
                  <p className="text-xs text-red-500 mt-1">{parameterErrors[schemaKey]}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border rounded-md p-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Static Parameters</p>
            <p className="text-xs text-muted-foreground">Parameters sent on every call</p>
          </div>
          {!isView && (
            <Button size="sm" variant="secondary" onClick={addStaticParameter}>+ Add</Button>
          )}
        </div>
        {(definition.staticParameters || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No static parameters defined.</p>
        )}
        {(definition.staticParameters || []).map((param: any, index: number) => {
          const valueKey = `static-${index}-value`;
          return (
            <div key={index} className="rounded-md border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Parameter {index + 1}</p>
                {!isView && (
                  <Button size="sm" variant="ghost" onClick={() => removeParameter("static", index)}>Remove</Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={param?.name || ""}
                    onChange={(e) => handleStaticParameterChange(index, "name", e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <select
                    className="w-full border rounded px-3 py-2 mt-1 bg-background"
                    value={param?.location || ParameterLocation.QUERY}
                    onChange={(e) => handleStaticParameterChange(index, "location", e.target.value)}
                    disabled={isView}
                  >
                    {parameterLocations.map((location) => (
                      <option key={location} value={location}>
                        {parameterLocationLabels[location as ParameterLocation] || location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Value</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1 min-h-[60px] resize-none"
                  value={valueDrafts[valueKey] ?? renderStaticValue(param?.value)}
                  onChange={(e) => setValueDrafts((prev) => ({ ...prev, [valueKey]: e.target.value }))}
                  onBlur={() => handleStaticValueBlur(index)}
                  disabled={isView}
                  placeholder="Plain text or JSON"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border rounded-md p-2 space-y-3">
        <p className="font-semibold text-sm">HTTP Settings</p>
        <div className="grid gap-3">
          <div>
            <label className="text-sm font-medium">Base URL Pattern</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={definition.http?.baseUrlPattern || ""}
              onChange={(e) => handleHttpChange("baseUrlPattern", e.target.value)}
              disabled={isView}
              placeholder="https://api.example.com/resource"
            />
          </div>
          <div>
            <label className="text-sm font-medium">HTTP Method</label>
            <select
              className="w-full border rounded px-3 py-2 mt-1 bg-background"
              value={definition.http?.httpMethod || "GET"}
              onChange={(e) => handleHttpChange("httpMethod", e.target.value)}
              disabled={isView}
            >
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={Boolean(definition.precomputable)}
          onChange={(e) => handleSimpleFieldChange("precomputable", e.target.checked)}
          disabled={isView}
        />
        Precomputable
      </label>
    </div>
  );
}