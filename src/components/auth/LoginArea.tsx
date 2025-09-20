// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, UserPlus, ChevronDown, Settings, HelpCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.tsx';
import LoginDialog from './LoginDialog';
import SignupDialog from './SignupDialog';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export interface LoginAreaProps {
  className?: string;
}

export function LoginArea({ className }: LoginAreaProps) {
  const { t } = useTranslation();
  const { currentUser } = useLoggedInAccounts();
  const navigate = useNavigate();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  const handleLogin = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
  };

  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={() => setLoginDialogOpen(true)} />
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button className='flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground'>
              <Avatar className='w-10 h-10'>
                <AvatarFallback>
                  <User className='w-5 h-5 text-muted-foreground' />
                </AvatarFallback>
              </Avatar>
              <div className='flex-1 text-left truncate'>
                <p className='font-medium text-sm truncate'>{t('anonymous')}</p>
              </div>
              <ChevronDown className='w-4 h-4 text-muted-foreground' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <Settings className='w-4 h-4' />
              <span>{t('settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open('https://soapbox.pub/shakespeare-resources/', '_blank')}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <HelpCircle className='w-4 h-4' />
              <span>{t('help')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setLoginDialogOpen(true)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <User className='w-4 h-4' />
              <span>{t('logIn')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSignupDialogOpen(true)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <UserPlus className='w-4 h-4' />
              <span>{t('signUp')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLogin}
        onSignup={() => setSignupDialogOpen(true)}
      />

      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={() => setSignupDialogOpen(false)}
      />
    </div>
  );
}