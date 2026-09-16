import * as React from "react"
import { useTranslation } from "react-i18next"
import { GalleryVerticalEnd } from "lucide-react"
import { LoginForm } from "./login-form"
import { loginWithPassword } from "../lib/auth"
import { ApiError } from "../api/types"

interface LoginPageProps {
  onLogin?: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useTranslation("auth")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get("email") || "").trim()
    const password = String(fd.get("password") || "")
    if (!email || !password) {
      setError(t("errorRequired"))
      return
    }
    setLoading(true)
    try {
      await loginWithPassword(email, password)
      onLogin?.()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("errorGeneric")
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-background text-foreground">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            {t("brand")}
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src="/login-hero.png"
          alt={t("heroImageAlt")}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  )
}
