import { useState, useEffect } from 'react';
import { useGit } from '@/hooks/useGit';
import { Button } from '@/components/ui/button';
import { ContributeWizard } from './ContributeWizard';
import { GitPullRequest } from 'lucide-react';
import { detectGitHost } from '@/lib/git-hosts';

interface ContributeButtonProps {
  projectDir: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ContributeButton({ projectDir, variant = 'outline', size = 'default', className }: ContributeButtonProps) {
  const { git } = useGit();
  const [showWizard, setShowWizard] = useState(false);
  const [canContribute, setCanContribute] = useState(false);

  useEffect(() => {
    const checkContributeAvailable = async () => {
      try {
        // Check if there's a remote with a supported host
        const upstreamUrl = await git.getRemoteURL(projectDir, 'upstream');
        const originUrl = await git.getRemoteURL(projectDir, 'origin');
        const remoteUrl = upstreamUrl || originUrl;

        if (remoteUrl) {
          const hostType = detectGitHost(remoteUrl);
          setCanContribute(hostType !== 'unknown');
        } else {
          setCanContribute(false);
        }
      } catch {
        setCanContribute(false);
      }
    };

    checkContributeAvailable();
  }, [git, projectDir]);

  if (!canContribute) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowWizard(true)}
        className={className}
      >
        <GitPullRequest className="h-4 w-4 mr-2" />
        Propose Changes
      </Button>

      <ContributeWizard
        projectDir={projectDir}
        open={showWizard}
        onOpenChange={setShowWizard}
      />
    </>
  );
}
