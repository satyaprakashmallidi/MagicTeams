'use client';

import { useState } from 'react';
import { Button } from './button';
import { Icon } from './icons';
import { useToast } from '@/hooks/use-toast';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        title: "Copied!",
        description: `${label || 'Value'} copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleCopy}
    >
      <Icon 
        name={copied ? "check" : "copy"} 
        className="h-4 w-4 text-muted-foreground hover:text-foreground" 
      />
    </Button>
  );
}
