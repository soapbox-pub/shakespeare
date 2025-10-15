import { useState, useEffect } from 'react';
import { useContribute } from '@/hooks/useContribute';
import { useGit } from '@/hooks/useGit';
import { useBuildProject } from '@/hooks/useBuildProject';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthStep } from './AuthStep';
import { DiffView } from './DiffView';
import { AlertCircle, CheckCircle2, Loader2, GitFork, Upload, GitPullRequest } from 'lucide-react';
import type { PullRequest } from '@/lib/git-hosts';

interface ContributeWizardProps {
  projectDir: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (pr: PullRequest) => void;
}

export function ContributeWizard({ projectDir, open, onOpenChange, onComplete }: ContributeWizardProps) {
  const { git } = useGit();
  const { mutateAsync: buildProject } = useBuildProject();
  const { needsAuth, authenticate, contribute, isLoading, error, step, message, pr } = useContribute();

  const [wizardStep, setWizardStep] = useState<'auth' | 'review' | 'branch' | 'checks' | 'result'>('auth');
  const [authStatus, setAuthStatus] = useState<{ needsAuth: boolean; host?: string; url?: string } | null>(null);
  const [formData, setFormData] = useState({
    branchName: '',
    commitMessage: '',
    prTitle: '',
    prBody: '',
    maintainerCanModify: true,
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [buildPassed, setBuildPassed] = useState(false);
  const [checkingBuild, setCheckingBuild] = useState(false);

  // Check auth status when dialog opens
  useEffect(() => {
    if (open) {
      needsAuth(projectDir).then(status => {
        setAuthStatus(status);
        if (!status.needsAuth) {
          setWizardStep('review');
        } else {
          setWizardStep('auth');
        }
      });
    }
  }, [open, projectDir, needsAuth]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setWizardStep('auth');
      setFormData({
        branchName: '',
        commitMessage: '',
        prTitle: '',
        prBody: '',
        maintainerCanModify: true,
      });
      setValidationErrors({});
      setBuildPassed(false);
    }
  }, [open]);

  const handleAuthComplete = (host: string, token: string, username?: string) => {
    authenticate(host, token, username);
    setWizardStep('review');
  };

  const handleReviewNext = () => {
    setWizardStep('branch');
  };

  const validateBranchForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.branchName.trim()) {
      errors.branchName = 'Branch name is required';
    } else if (!/^[a-zA-Z0-9._\/-]+$/.test(formData.branchName)) {
      errors.branchName = 'Invalid branch name. Use only letters, numbers, dots, dashes, and slashes.';
    }

    if (!formData.commitMessage.trim()) {
      errors.commitMessage = 'Commit message is required';
    }

    if (!formData.prTitle.trim()) {
      errors.prTitle = 'Pull request title is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBranchNext = async () => {
    if (!validateBranchForm()) return;

    setWizardStep('checks');
    
    // Run build check
    setCheckingBuild(true);
    try {
      await buildProject(projectDir);
      setBuildPassed(true);
    } catch (error) {
      setBuildPassed(false);
      setValidationErrors(prev => ({
        ...prev,
        build: 'Build failed. Please fix errors before submitting.',
      }));
    } finally {
      setCheckingBuild(false);
    }
  };

  const handleSubmit = async () => {
    if (!buildPassed) {
      setValidationErrors(prev => ({
        ...prev,
        build: 'Build must pass before submitting',
      }));
      return;
    }

    const result = await contribute({
      projectDir,
      branchName: formData.branchName,
      commitMessage: formData.commitMessage,
      prTitle: formData.prTitle,
      prBody: formData.prBody,
      maintainerCanModify: formData.maintainerCanModify,
    });

    if (result) {
      setWizardStep('result');
      onComplete?.(result);
    }
  };

  const getProgress = () => {
    switch (wizardStep) {
      case 'auth': return 20;
      case 'review': return 40;
      case 'branch': return 60;
      case 'checks': return 80;
      case 'result': return 100;
      default: return 0;
    }
  };

  const getStepIcon = () => {
    if (step === 'fork') return <GitFork className="h-5 w-5" />;
    if (step === 'push') return <Upload className="h-5 w-5" />;
    if (step === 'pr') return <GitPullRequest className="h-5 w-5" />;
    if (step === 'complete') return <CheckCircle2 className="h-5 w-5" />;
    return <Loader2 className="h-5 w-5 animate-spin" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propose Changes</DialogTitle>
          <DialogDescription>
            Submit your changes to the original project
          </DialogDescription>
        </DialogHeader>

        <Progress value={getProgress()} className="mb-4" />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {wizardStep === 'auth' && authStatus && (
          <AuthStep
            host={authStatus.host!}
            onComplete={handleAuthComplete}
          />
        )}

        {wizardStep === 'review' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Review Your Changes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Review the changes you're proposing to submit
              </p>
            </div>
            <DiffView projectDir={projectDir} />
          </div>
        )}

        {wizardStep === 'branch' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Branch & Commit Details</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Describe your changes and create a branch
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                placeholder="my-feature-branch"
                value={formData.branchName}
                onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
              />
              {validationErrors.branchName && (
                <p className="text-sm text-destructive">{validationErrors.branchName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="commit-message">Commit Message</Label>
              <Input
                id="commit-message"
                placeholder="Brief description of your changes"
                value={formData.commitMessage}
                onChange={(e) => setFormData(prev => ({ ...prev, commitMessage: e.target.value }))}
              />
              {validationErrors.commitMessage && (
                <p className="text-sm text-destructive">{validationErrors.commitMessage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-title">Pull Request Title</Label>
              <Input
                id="pr-title"
                placeholder="Summary of your contribution"
                value={formData.prTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, prTitle: e.target.value }))}
              />
              {validationErrors.prTitle && (
                <p className="text-sm text-destructive">{validationErrors.prTitle}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-body">Description (optional)</Label>
              <Textarea
                id="pr-body"
                placeholder="Detailed description of what changed and why..."
                value={formData.prBody}
                onChange={(e) => setFormData(prev => ({ ...prev, prBody: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="maintainer-edit"
                checked={formData.maintainerCanModify}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, maintainerCanModify: checked === true }))
                }
              />
              <Label htmlFor="maintainer-edit" className="text-sm font-normal cursor-pointer">
                Allow maintainers to edit your changes
              </Label>
            </div>
          </div>
        )}

        {wizardStep === 'checks' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Pre-submission Checks</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Validating your changes before submission
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm">Type Check & Build</span>
                {checkingBuild ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : buildPassed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>

            {validationErrors.build && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationErrors.build}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {wizardStep === 'result' && pr && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Pull Request Created!</h3>
            </div>

            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">PR #{pr.number}:</span> {pr.title}
              </p>
              <a 
                href={pr.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View Pull Request →
              </a>
            </div>
          </div>
        )}

        {isLoading && message && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            {getStepIcon()}
            <span className="text-sm">{message}</span>
          </div>
        )}

        <DialogFooter>
          {wizardStep === 'auth' && authStatus?.needsAuth && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {wizardStep === 'review' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleReviewNext}>
                Continue
              </Button>
            </>
          )}

          {wizardStep === 'branch' && (
            <>
              <Button variant="outline" onClick={() => setWizardStep('review')}>
                Back
              </Button>
              <Button onClick={handleBranchNext}>
                Run Checks
              </Button>
            </>
          )}

          {wizardStep === 'checks' && (
            <>
              <Button variant="outline" onClick={() => setWizardStep('branch')}>
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!buildPassed || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Pull Request'
                )}
              </Button>
            </>
          )}

          {wizardStep === 'result' && (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
