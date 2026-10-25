"use client";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
// [PasswordInput]: input con toggle ver/ocultar contraseña | [Patrón]: Composite | [Principio]: SRP | [Paradigma]: Funcional + Reactivo

export type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

// [forwardRef]: compatibilidad con react-hook-form `register()` | [Patrón]: forwardRef
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "control flex w-full pr-10", // [Sistema de diseño]: misma forma que el resto de campos
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
