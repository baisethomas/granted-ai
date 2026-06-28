import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:ring-offset-0 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(33,134,235,0.26)] hover:bg-[#1559C9] active:translate-y-px disabled:bg-[#EEF1F6] disabled:text-[#AEB6C4] disabled:shadow-none disabled:opacity-100",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-[#EEF1F6] disabled:text-[#AEB6C4] disabled:opacity-100",
        outline:
          "border-[1.5px] border-[#E6E9EF] bg-background text-[#0C1B33] hover:border-[#C7CFDD] hover:bg-[#FBFBFD] disabled:bg-[#EEF1F6] disabled:text-[#AEB6C4] disabled:opacity-100",
        // secondary intentionally matches outline — differentiate later if needed
        secondary:
          "border-[1.5px] border-[#E6E9EF] bg-background text-[#0C1B33] hover:border-[#C7CFDD] hover:bg-[#FBFBFD] disabled:bg-[#EEF1F6] disabled:text-[#AEB6C4] disabled:opacity-100",
        ghost:
          "text-primary hover:bg-[#EAF2FE] disabled:opacity-50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[44px] px-[22px] py-[13px]",
        sm: "h-9 px-4 py-2 text-sm",
        lg: "h-12 px-8 py-3",
        icon: "h-11 w-11 shrink-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
