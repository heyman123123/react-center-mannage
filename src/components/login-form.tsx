import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "./ui/field"
import { Input } from "./ui/input"

export function LoginForm({
  className,
  onSubmit,
  loading,
  error,
  ...props
}: React.ComponentProps<"form"> & {
  loading?: boolean
  error?: string | null
}) {
  const { t } = useTranslation("auth")

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("welcome")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("subtitle")}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            required
            autoComplete="username"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("passwordPlaceholder")}
            required
            autoComplete="current-password"
          />
        </Field>
        {error ? (
          <p className="text-sm text-destructive text-center" role="alert">
            {error}
          </p>
        ) : null}
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? t("submitting") : t("submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
