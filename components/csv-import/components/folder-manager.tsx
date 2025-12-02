'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Folder } from '../types';
import { FolderService } from '../services/folder-service';

interface FolderManagerProps {
  userId: string | null;
  selectedFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  onFolderCreated?: () => void;
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  className?: string;
}

export function FolderManager({ 
  userId, 
  selectedFolderId, 
  onFolderChange,
  onFolderCreated,
  folders,
  setFolders,
  className = "" 
}: FolderManagerProps) {
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  
  const { toast } = useToast();

  // Folders are now managed by parent component
  console.log('🐛 FOLDER MANAGER DEBUG:');
  console.log('userId:', userId);
  console.log('selectedFolderId:', selectedFolderId);
  console.log('folders prop:', folders);
  console.log('folders.length:', folders.length);

  const handleCreateFolder = async () => {
    if (!userId || !newFolderName.trim()) return;

    try {
      const newFolder = await FolderService.createFolder(newFolderName.trim(), userId);
      setFolders(prev => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      setShowCreateDialog(false);
      onFolderChange(newFolder.id);
      
      toast({
        title: "Success",
        description: `Folder "${newFolder.name}" created successfully`,
      });

      // Refresh files after folder creation
      if (onFolderCreated) {
        onFolderCreated();
      }
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error",
        description: error.message?.includes('duplicate') 
          ? "A folder with this name already exists" 
          : "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleRenameFolder = async () => {
    if (!userId || !folderToRename || !renameFolderName.trim()) return;

    try {
      const updatedFolder = await FolderService.updateFolder(
        folderToRename.id, 
        renameFolderName.trim(), 
        userId
      );
      
      setFolders(prev => 
        prev.map(f => f.id === updatedFolder.id ? updatedFolder : f)
           .sort((a, b) => a.name.localeCompare(b.name))
      );
      
      setFolderToRename(null);
      setRenameFolderName('');
      setShowRenameDialog(false);
      
      toast({
        title: "Success",
        description: `Folder renamed to "${updatedFolder.name}"`,
      });
    } catch (error: any) {
      console.error('Error renaming folder:', error);
      toast({
        title: "Error",
        description: error.message?.includes('duplicate') 
          ? "A folder with this name already exists" 
          : "Failed to rename folder",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (!userId) return;
    
    if (!confirm(`Are you sure you want to delete "${folder.name}"? Files in this folder will be moved to "Uncategorized".`)) {
      return;
    }

    try {
      await FolderService.deleteFolder(folder.id, userId);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
      
      // If the deleted folder was selected, reset to null
      if (selectedFolderId === folder.id) {
        onFolderChange(null);
      }
      
      toast({
        title: "Success",
        description: `Folder "${folder.name}" deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    }
  };

  const startRename = (folder: Folder) => {
    setFolderToRename(folder);
    setRenameFolderName(folder.name);
    setShowRenameDialog(true);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Label className="text-sm font-medium whitespace-nowrap">Folder:</Label>
      
      <Select 
        value={selectedFolderId || "uncategorized"} 
        onValueChange={(value) => {
          console.log('🐛 SELECT CHANGE:', value);
          const newFolderId = value === "uncategorized" ? null : value;
          console.log('🐛 CALLING onFolderChange with:', newFolderId);
          onFolderChange(newFolderId);
        }}
        disabled={loading}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="uncategorized">
            <div className="flex items-center gap-2">
              <Icon name="folder" className="h-4 w-4" />
              Uncategorized
            </div>
          </SelectItem>
          {folders.map(folder => (
            <SelectItem key={folder.id} value={folder.id}>
              <div className="flex items-center gap-2">
                <Icon name="folder" className="h-4 w-4" />
                {folder.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Create Folder Button */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" >
            <Icon name="folderPlus" className="h-4 w-4 mr-2" />
            Create New Folder
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name..."
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder Management Button */}
      {folders.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Icon name="moreHorizontal" className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Folders</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {folders.map(folder => (
                <div key={folder.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Icon name="folder" className="h-4 w-4" />
                    <span>{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => startRename(folder)}
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteFolder(folder)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="renameFolderName">Folder Name</Label>
              <Input
                id="renameFolderName"
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                placeholder="Enter new folder name..."
                onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRenameFolder}
                disabled={!renameFolderName.trim()}
              >
                Rename Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}