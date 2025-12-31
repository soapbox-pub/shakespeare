import { useBadgeAwardNotifications } from '@/hooks/useBadgeAwardNotifications';
import { BadgeAwardModal } from './BadgeAwardModal';

/**
 * Global badge award notification component.
 * Listens for badge awards and displays a modal when a new badge is received.
 * This component should be placed at the App level to work globally.
 */
export function BadgeAwardNotification() {
  const { newAward, clearNewAward } = useBadgeAwardNotifications();

  return <BadgeAwardModal award={newAward} onClose={clearNewAward} />;
}

