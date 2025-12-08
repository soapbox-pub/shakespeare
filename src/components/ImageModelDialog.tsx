import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { ModelSelector } from '@/components/ModelSelector';

interface ImageModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageModelDialog({ open, onOpenChange }: ImageModelDialogProps) {
  const { settings, updateSettings } = useAISettings();
  const { models } = useProviderModels();
  const [selectedModel, setSelectedModel] = useState(settings.imageModel || '');

  // Update selected model when settings change
  useEffect(() => {
    if (settings.imageModel) {
      setSelectedModel(settings.imageModel);
    }
  }, [settings.imageModel]);

  // Filter models to only show those with image generation capability
  const imageModels = models.filter(model =>
    model.modalities?.includes('image')
  );

  // Check if the selected model supports image generation
  const selectedModelSupportsImage = selectedModel
    ? imageModels.some(m => m.fullId === selectedModel)
    : false;

  const handleSave = () => {
    if (selectedModel && selectedModelSupportsImage) {
      updateSettings({ imageModel: selectedModel });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Image Model</DialogTitle>
          <DialogDescription>
            Select an AI model that supports image generation. The model selector will show all available models, but only models with image generation capabilities can be saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="image-model">Image Model</Label>
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder="Select an image model..."
            />
          </div>

          {selectedModel && !selectedModelSupportsImage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The selected model does not support image generation. Please choose a different model.
              </AlertDescription>
            </Alert>
          )}

          {imageModels.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No models with image generation capabilities found. Please configure an AI provider that supports image generation in Settings &gt; AI.
              </AlertDescription>
            </Alert>
          )}

          {selectedModel && selectedModelSupportsImage && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedModel}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedModel || !selectedModelSupportsImage}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
