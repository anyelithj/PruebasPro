import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// [buttonVariants]: variantes del átomo Button apoyadas en las utilidades del sistema de diseño (btn, btn-primary…) de globals.css | [Patrón]: Variant (CVA) + Design System | [Principio]: DRY + SSOT
// `cva` (class-variance-authority): mapea props tipadas (variant/size) → clases; `VariantProps` infiere los tipos permitidos
const buttonVariants = cva(
  "btn [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "btn-primary", // Degradado morado de marca (igual en todos los temas)
        outline: "btn-outline",
        secondary: "btn-outline", // Mismo aspecto que outline → una sola forma de botón secundario en toda la app
        ghost: "btn-ghost",
        destructive: "btn-danger",
        link: "h-auto! px-0! text-primary underline-offset-4 hover:underline", // `!` (Tailwind v4): prioridad sobre el tamaño del btn
      },
      size: {
        default: "",
        xs: "btn-sm",
        sm: "btn-sm",
        lg: "btn-lg",
        icon: "size-10 px-0!",
        "icon-xs": "size-7 px-0!",
        "icon-sm": "size-8 px-0!",
        "icon-lg": "size-11 px-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
