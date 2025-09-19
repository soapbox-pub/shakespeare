import { Settings2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/ThemePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";

export function Preferences() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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
            Back to Settings
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-primary" />
              Preferences
            </h1>
            <p className="text-muted-foreground">
              Manage your general application preferences and appearance settings.
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings2 className="h-6 w-6 text-primary" />
            Preferences
          </h1>
          <p className="text-muted-foreground">
            Manage your general application preferences and appearance settings.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize how the application looks and feels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-picker">Theme</Label>
            <div className="w-full max-w-xs">
              <ThemePicker />
            </div>
            <p className="text-sm text-muted-foreground">
              Choose between light, dark, or system theme preference.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Preferences;