import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Zap, GlobeLock, Palette } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="text-6xl mb-4">🎭</div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Welcome to Shakespeare
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          Build custom Nostr websites with AI assistance. Let's get you set up in just a few steps.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-lg">AI-Powered</CardTitle>
            <CardDescription>
              Describe your vision and let AI build your Nostr website
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <GlobeLock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-lg">Decentralized</CardTitle>
            <CardDescription>
              Built with the Nostr protocol for censorship resistance
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <Palette className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-lg">Customizable</CardTitle>
            <CardDescription>
              Edit code directly or let AI make changes based on your feedback
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-2 pt-4">
        <Button
          onClick={onNext}
          size="lg"
          className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          onClick={onSkip}
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs h-7"
        >
          Skip for now
        </Button>
      </div>


    </div>
  );
}