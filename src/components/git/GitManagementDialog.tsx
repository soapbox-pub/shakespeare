import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git Management
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
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

            {/* Branches Tab */}
            <TabsContent value="branches" className="mt-0 p-6 overflow-y-auto flex-1">
              <BranchManager
                projectId={projectId}
                currentBranch={gitStatus?.currentBranch || null}
                onBranchChange={handleBranchChange}
              />
            </TabsContent>

            {/* Changes Tab */}
            <TabsContent value="changes" className="mt-0 overflow-y-auto flex-1">
              <DiffViewer
                projectId={projectId}
                compareFrom="HEAD"
              />
            </TabsContent>

            {/* Compare Tab */}
            <TabsContent value="compare" className="mt-0 p-6 overflow-y-auto flex-1">
              <CompareView projectId={projectId} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
