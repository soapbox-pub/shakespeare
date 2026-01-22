import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import OpenAI from 'openai';

interface ToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
}

export function ToolsDialog({ open, onOpenChange, tools }: ToolsDialogProps) {
  const toolEntries = Object.entries(tools);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Available Tools</DialogTitle>
          <DialogDescription>
            The current session's full list of available tools ({toolEntries.length} tools)
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full pr-4">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {toolEntries.map(([name, tool]) => {
              const func = 'function' in tool ? tool.function : undefined;
              return (
                <AccordionItem key={name} value={name} className="border rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-mono hover:no-underline py-3 outline-none focus:outline-none focus-visible:outline-none">
                    {name}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="font-semibold mb-1">Description:</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">
                          {func?.description || 'No description available'}
                        </div>
                      </div>
                      {func?.parameters && (
                        <div>
                          <div className="font-semibold mb-1">Parameters:</div>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                            {JSON.stringify(func.parameters, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
