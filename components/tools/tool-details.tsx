import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ToolForm from "./tool-form";

interface Tool {
  toolId: string;
  name: string;
  definition: any;
}

export default function ToolDetails({ tool, onEdit }: { tool: Tool | null, onEdit?: () => void }) {
  if (!tool) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a tool to view and edit details
      </div>
    );
  }

  // Dummy handlers for read-only form
  const noOp = () => {};
  const emptySchemaDrafts = {};
  const emptyParameterErrors = {};
  const emptyValueDrafts = {};
  const setEmptyValueDrafts = () => {};


  return (
    <Card className="max-w-full mx-auto">
      <CardHeader>
        <CardTitle>{tool.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
      <ToolForm
        name={tool.name}
        definition={tool.definition}
        isView={true}
        handleNameChange={noOp}
        handleSimpleFieldChange={noOp}
        handleHttpChange={noOp}
        handleDynamicParameterChange={noOp}
        handleStaticParameterChange={noOp}
        addDynamicParameter={noOp}
        addStaticParameter={noOp}
        removeParameter={noOp}
        schemaDrafts={emptySchemaDrafts}
        handleSchemaDraftChange={noOp}
        handleDynamicSchemaBlur={noOp}
        parameterErrors={emptyParameterErrors}
        valueDrafts={emptyValueDrafts}
        setValueDrafts={setEmptyValueDrafts}
        handleStaticValueBlur={noOp}
      />
      </CardContent>
      <CardFooter className="p-4">
        <Button onClick={onEdit}>Edit Tool</Button>
      </CardFooter>
    </Card>
  );
}