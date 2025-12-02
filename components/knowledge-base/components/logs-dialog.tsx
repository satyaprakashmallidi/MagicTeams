'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLogs, type LogLevel } from '@/store/use-logs';

interface LogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogsDialog({ isOpen, onClose }: LogsDialogProps) {
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const { logs, clearLogs, getLogs } = useLogs();
  const filteredLogs = filter === 'all' ? logs : getLogs(filter);

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      case 'debug':
        return 'text-gray-500';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col bg-white">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle>System Logs</DialogTitle>
            <div className="flex items-center gap-4">
              <Select value={filter} onValueChange={(value) => setFilter(value as LogLevel | 'all')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Filter logs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Logs</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warnings</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={clearLogs}
              >
                Clear Logs
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 border rounded-md p-4 my-4">
          <div className="space-y-2">
            {filteredLogs.map((log, index) => (
              <div 
                key={`${log.timestamp}-${index}`}
                className="font-mono text-sm border-b border-gray-100 pb-2 hover:bg-gray-50 transition-colors rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`font-semibold ${getLogColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="font-semibold text-gray-600">[{log.component}]</span>
                  <span>{log.message}</span>
                </div>
                {log.data && (
                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No logs to display
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t pt-4 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            Showing {filteredLogs.length} {filter === 'all' ? 'logs' : `${filter} logs`}
          </span>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
