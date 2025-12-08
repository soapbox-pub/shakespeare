import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAISettings } from '@/hooks/useAISettings';
import { ModelInput } from '@/components/ModelInput';

interface ImageModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageModelDialog({ open, onOpenChange }: ImageModelDialogProps) {
  const { settings, updateSettings } = useAISettings();
  const [selectedModel, setSelectedModel] = useState(settings.imageModel || '');

  // Update selected model when dialog opens or settings change
  useEffect(() => {
    if (open) {
      setSelectedModel(settings.imageModel || '');
    }
  }, [open, settings.imageModel]);

  const handleSave = () => {
    updateSettings({ imageModel: selectedModel || undefined });
    onOpenChange(false);
  };

  const imageModelFilter = useCallback((model: { type?: 'chat' | 'image'; modalities?: string[] }) => {
    // Filter out models that are definitely NOT image models
    // If type is "chat", exclude it
    if (model.type === 'chat') {
      return false;
    }
    // If modalities exist but don't include "image", exclude it
    if (model.modalities && !model.modalities.includes('image')) {
      return false;
    }
    // Otherwise include it (type is "image", modalities includes "image", or both are undefined)
    return true;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Image Model</DialogTitle>
          <DialogDescription>
            Select an AI model to use for image generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="image-model">Image Model</Label>
            <ModelInput
              value={selectedModel}
              onChange={setSelectedModel}
              className="flex-1"
              modelFilter={imageModelFilter}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
