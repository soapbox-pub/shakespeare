import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  GitCompare,
  Settings,
} from 'lucide-react';
import { BranchManager } from './BranchManager';
import { CompareView } from './CompareView';
import { DiffViewer } from './DiffViewer';
import { useGitStatus } from '@/hooks/useGitStatus';

interface GitManagementDialogProps {
  projectId: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: string;
}

export function GitManagementDialog({
  projectId,
  children,
  open,
  onOpenChange,
  defaultTab = 'branches',
}: GitManagementDialogProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);

  const handleBranchChange = () => {
    // Refetch git status when branches change
    refetchGitStatus();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col gap-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git Management
            </DialogTitle>
          </DialogHeader>

          {/* Tabs Container - takes remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              {/* Fixed Tab List */}
              <div className="border-b px-6 shrink-0">
                <TabsList className="h-auto p-0 bg-transparent">
                  <TabsTrigger
                    value="branches"
                    className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <GitBranch className="h-4 w-4" />
                    Branches
                  </TabsTrigger>
                  <TabsTrigger
                    value="changes"
                    className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <Settings className="h-4 w-4" />
                    Changes
                  </TabsTrigger>
                  <TabsTrigger
                    value="compare"
                    className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <GitCompare className="h-4 w-4" />
                    Compare
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable Tab Content */}
              <TabsContent value="branches" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <BranchManager
                      projectId={projectId}
                      currentBranch={gitStatus?.currentBranch || null}
                      onBranchChange={handleBranchChange}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="changes" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col min-h-0">
                <div className="flex-1 min-h-0">
                  <DiffViewer
                    projectId={projectId}
                    compareFrom="HEAD"
                  />
                </div>
              </TabsContent>

              <TabsContent value="compare" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <CompareView projectId={projectId} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
