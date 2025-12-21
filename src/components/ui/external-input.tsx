import { forwardRef, useState, useEffect, useRef } from "react"
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

const ExternalInput = forwardRef<HTMLInputElement, ExternalInputProps>(
  ({ className, type, url, urlTitle, value, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [buttonWidth, setButtonWidth] = useState(0)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Determine if we have a value (works for both controlled and uncontrolled)
    const hasValue = Boolean(value || (props.defaultValue && !value))

    const isPasswordType = type === 'password'
    const showEyeToggle = isPasswordType && hasValue
    const showExternalButton = url && urlTitle && !hasValue

    // Measure the button width when it's rendered
    useEffect(() => {
      if (showExternalButton && buttonRef.current) {
        const width = buttonRef.current.offsetWidth
        setButtonWidth(width)
      } else {
        setButtonWidth(0)
      }
    }, [showExternalButton, urlTitle])

    // Calculate padding-right based on what's showing
    const paddingRight = showEyeToggle
      ? '2.5rem' // 40px for eye toggle
      : showExternalButton && buttonWidth > 0
        ? `${buttonWidth + 8}px` // button width + 8px spacing
        : undefined

    return (
      <div className={cn("relative", className)}>
        <input
          type={isPasswordType && !showPassword ? "password" : "text"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            {
              "ring-2 ring-ring ring-offset-2": isFocused,
            },
          )}
          style={{ paddingRight }}
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
            ref={buttonRef}
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
