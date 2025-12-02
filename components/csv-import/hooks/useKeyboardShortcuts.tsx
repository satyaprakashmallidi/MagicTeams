'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsProps {
  onUpload: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSearch: () => void;
  onStartCampaign: () => void;
  onHelp: () => void;
  onEscape: () => void;
  isEnabled: boolean;
}

export function useKeyboardShortcuts({
  onUpload,
  onSelectAll,
  onDeselectAll,
  onSearch,
  onStartCampaign,
  onHelp,
  onEscape,
  isEnabled
}: KeyboardShortcutsProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabled) return;

    // Don't trigger shortcuts when user is typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Escape in inputs
      if (event.key === 'Escape') {
        onEscape();
      }
      return;
    }

    const isCtrl = event.ctrlKey || event.metaKey;

    switch (true) {
      case isCtrl && event.key === 'u':
        event.preventDefault();
        onUpload();
        break;

      case isCtrl && event.key === 'a':
        event.preventDefault();
        onSelectAll();
        break;

      case isCtrl && event.key === 'd':
        event.preventDefault();
        onDeselectAll();
        break;

      case isCtrl && event.key === 'f':
        event.preventDefault();
        onSearch();
        break;

      case event.key === 'Enter' && !isCtrl:
        event.preventDefault();
        onStartCampaign();
        break;

      case event.key === '?':
        event.preventDefault();
        onHelp();
        break;

      case event.key === 'Escape':
        event.preventDefault();
        onEscape();
        break;
    }
  }, [isEnabled, onUpload, onSelectAll, onDeselectAll, onSearch, onStartCampaign, onHelp, onEscape]);

  useEffect(() => {
    if (isEnabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEnabled, handleKeyDown]);

  return null;
}