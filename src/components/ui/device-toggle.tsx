import { Button } from '@/components/ui/button';
import { Laptop, Tablet, Smartphone } from 'lucide-react';

export type DeviceMode = 'laptop' | 'tablet' | 'phone';

interface DeviceToggleProps {
  mode: DeviceMode;
  onModeChange: (mode: DeviceMode) => void;
  className?: string;
}

const devices: DeviceMode[] = ['laptop', 'tablet', 'phone'];

const deviceIcons = {
  laptop: Laptop,
  tablet: Tablet,
  phone: Smartphone,
};

export function DeviceToggle({ mode, onModeChange, className }: DeviceToggleProps) {
  const handleClick = () => {
    const currentIndex = devices.indexOf(mode);
    const nextIndex = (currentIndex + 1) % devices.length;
    onModeChange(devices[nextIndex]);
  };

  const Icon = deviceIcons[mode];

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={className}
      title={`Current: ${mode} (click to toggle)`}
    >
      <Icon className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Button>
  );
}
