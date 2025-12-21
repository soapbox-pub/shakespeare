import * as React from "react"
import { Eye, EyeOff, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExternalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The type of input - either 'text' or 'password' */
  type: 'text' | 'password';
  /** URL to open when the external link button is clicked. If not provided, button won't be shown. */
  url?: string;
  /** Title/label for the external link button. If not provided, button won't be shown. */
  urlTitle?: string;
}

const ExternalInput = React.forwardRef<HTMLInputElement, ExternalInputProps>(
  ({ className, type, url, urlTitle, value, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)

    // Determine if we have a value (works for both controlled and uncontrolled)
    const hasValue = Boolean(value || (props.defaultValue && !value))

    const isPasswordType = type === 'password'
    const showEyeToggle = isPasswordType && hasValue
    const showExternalButton = url && urlTitle && !hasValue

    return (
      <div className={cn("relative", className)}>
        <input
          type={isPasswordType && !showPassword ? "password" : "text"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            (showEyeToggle || showExternalButton) && "pr-10",
            isFocused && "ring-2 ring-ring ring-offset-2"
          )}
          ref={ref}
          value={value}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />
        {showEyeToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.disabled}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
        {showExternalButton && (
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            onClick={() => window.open(url, '_blank')}
          >
            {urlTitle}
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }
)
ExternalInput.displayName = "ExternalInput"

export { ExternalInput }
