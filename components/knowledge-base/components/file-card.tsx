'use client';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FileCardProps {
    name: string;
    size?: number;
    date: Date;
    url: string;
    isAttached: boolean;
    onToggleAttach: () => void;
    onDelete: () => void;
}

export function FileCard({ name, size, date, url, isAttached, onToggleAttach, onDelete }: FileCardProps) {
    const formatSize = (bytes?: number) => {
        if (!bytes) return 'Unknown size';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    return (
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between group relative overflow-hidden">
            <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-teal-900/20 flex items-center justify-center flex-shrink-0">
                    <Icon name="file-text" className="h-6 w-6 text-teal-500" />
                </div>
                <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate pr-4" title={name}>
                        {name}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>{formatSize(size)}</span>
                        <span>{format(date, 'MM/dd/yyyy')}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                    variant={isAttached ? "secondary" : "outline"}
                    size="sm"
                    onClick={onToggleAttach}
                    className={cn(
                        "min-w-[100px]",
                        isAttached
                            ? "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-teal-500/20 border hover:text-teal-700"
                            : "border-teal-500/50 text-teal-500 hover:bg-teal-500/10 hover:text-teal-400"
                    )}
                >
                    <Icon name={isAttached ? "check-circle" : "paperclip"} className="h-4 w-4 mr-2" />
                    {isAttached ? "Attached" : "Attach"}
                </Button>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(url, '_blank')}
                    className="bg-muted hover:bg-muted/80"
                >
                    <Icon name="download" className="h-4 w-4 mr-2" />
                    Download
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onDelete}
                    title="Delete file"
                >
                    <Icon name="x" className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
