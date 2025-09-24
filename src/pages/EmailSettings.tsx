import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';

export function EmailSettings() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check localStorage on component mount
  useEffect(() => {
    const hasSubscribed = localStorage.getItem('shakespeare-email-subscribed');
    if (hasSubscribed === 'true') {
      setIsSubmitted(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('email', email.trim());
      formData.append('tag_id', '8982396');

      // Include npub if user is signed in
      if (user?.pubkey) {
        const npub = nip19.npubEncode(user.pubkey);
        formData.append('npub', npub);
      }

      // Submit to Mailchimp using the same setup as soapbox2
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://pub.us7.list-manage.com/subscribe/post?u=f1f718a93795f42a604d558d8&id=f7271442a0&f_id=00ffa3e4f0';
      form.target = '_blank'; // Open in new tab
      form.style.display = 'none';

      // Add email field
      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.name = 'EMAIL';
      emailInput.value = email.trim();
      form.appendChild(emailInput);

      // Add tag field with the new Shakespeare tag ID
      const tagInput = document.createElement('input');
      tagInput.type = 'hidden';
      tagInput.name = 'tags';
      tagInput.value = '8982396';
      form.appendChild(tagInput);

      // Add npub if available
      if (user?.pubkey) {
        const npubInput = document.createElement('input');
        npubInput.type = 'text';
        npubInput.name = 'NPUB';
        npubInput.value = nip19.npubEncode(user.pubkey);
        npubInput.style.display = 'none';
        form.appendChild(npubInput);
      }

      // Add honeypot field
      const honeypotInput = document.createElement('input');
      honeypotInput.type = 'text';
      honeypotInput.name = 'b_f1f718a93795f42a604d558d8_f7271442a0';
      honeypotInput.tabIndex = -1;
      honeypotInput.style.position = 'absolute';
      honeypotInput.style.left = '-5000px';
      form.appendChild(honeypotInput);

      // Add form to document and submit
      document.body.appendChild(form);
      form.submit();

      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(form);
      }, 1000);

      // Save subscription status to localStorage
      localStorage.setItem('shakespeare-email-subscribed', 'true');

      setIsSubmitted(true);
      toast({
        title: "Successfully subscribed!",
        description: "You'll receive Shakespeare updates and resources occasionally.",
      });
    } catch (error) {
      console.error('Email signup error:', error);
      toast({
        title: "Subscription failed",
        description: "There was an error subscribing you to updates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="p-6 space-y-6">
        {isMobile && (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="h-8 w-auto px-2 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToSettings')}
            </Button>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                {t('emailUpdates')}
              </h1>
              <p className="text-muted-foreground">
                {t('emailUpdatesDescriptionLong')}
              </p>
            </div>
          </div>
        )}

        {!isMobile && (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Mail className="h-6 w-6 text-primary" />
              {t('emailUpdates')}
            </h1>
            <p className="text-muted-foreground">
              {t('emailUpdatesDescriptionLong')}
            </p>
          </div>
        )}

        <div className="max-w-md">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    Thanks for subscribing!
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    You can opt out at any time using the unsubscribe link in our emails.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={() => navigate('/settings')}
                    className="w-full"
                  >
                    Back to Settings
                  </Button>
                  <Button
                    onClick={() => {
                      localStorage.removeItem('shakespeare-email-subscribed');
                      setIsSubmitted(false);
                      setEmail('');
                    }}
                    variant="outline"
                    className="w-full text-xs"
                  >
                    Subscribe with different email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {isMobile && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-8 w-auto px-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSettings')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Mail className="h-6 w-6 text-primary" />
              {t('emailUpdates')}
            </h1>
            <p className="text-muted-foreground">
              {t('emailUpdatesDescriptionLong')}
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            {t('emailUpdates')}
          </h1>
          <p className="text-muted-foreground">
            {t('emailUpdatesDescriptionLong')}
          </p>
        </div>
      )}

      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Stay Updated with Shakespeare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>



              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Subscribing...' : 'Subscribe to Updates'}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  You can opt out at any time using the unsubscribe link in our emails.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default EmailSettings;