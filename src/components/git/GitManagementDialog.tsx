import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  GitMerge,
  GitPullRequest,
  Settings,
  History,
} from 'lucide-react';
import { BranchManager } from './BranchManager';
import { CompareView } from './CompareView';
import { MergeDialog } from './MergeDialog';
import { PullRequestDialog } from './PullRequestDialog';
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
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isPRDialogOpen, setIsPRDialogOpen] = useState(false);

  const { data: gitStatus, refetch: refetchGitStatus } = useGitStatus(projectId);

  const handleBranchChange = () => {
    // Refetch git status when branches change
    refetchGitStatus();
  };

  const handleMergeComplete = () => {
    setIsMergeDialogOpen(false);
    refetchGitStatus();
  };

  // Get remote URL for PR creation
  const remoteUrl = gitStatus?.remotes.find(r => r.name === 'origin')?.url;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git Management
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="border-b px-6">
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
            <TabsContent value="branches" className="mt-0 p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  {gitStatus?.currentBranch && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setIsMergeDialogOpen(true)}
                      >
                        <GitMerge className="h-4 w-4" />
                        Merge
                      </Button>
                      {remoteUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setIsPRDialogOpen(true)}
                        >
                          <GitPullRequest className="h-4 w-4" />
                          Pull Request
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <BranchManager
                  projectId={projectId}
                  currentBranch={gitStatus?.currentBranch || null}
                  onBranchChange={handleBranchChange}
                />
              </div>
            </TabsContent>

            {/* Changes Tab */}
            <TabsContent value="changes" className="mt-0 h-[600px]">
              <DiffViewer
                projectId={projectId}
                compareFrom="HEAD"
              />
            </TabsContent>

            {/* Compare Tab */}
            <TabsContent value="compare" className="mt-0 p-6">
              <CompareView projectId={projectId} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <MergeDialog
        projectId={projectId}
        currentBranch={gitStatus?.currentBranch || null}
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        onMergeComplete={handleMergeComplete}
      />

      {/* Pull Request Dialog */}
      {remoteUrl && (
        <PullRequestDialog
          projectId={projectId}
          currentBranch={gitStatus?.currentBranch || null}
          remoteUrl={remoteUrl}
          open={isPRDialogOpen}
          onOpenChange={setIsPRDialogOpen}
        />
      )}
    </>
  );
}
