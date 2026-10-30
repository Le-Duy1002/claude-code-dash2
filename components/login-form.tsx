"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { CopyIcon } from "lucide-react"
import { toast } from "sonner"

import Image from "next/image"

import {
  getAuthErrorMessage,
  getGoogleRedirectResult,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signUpWithEmail,
} from "@/lib/auth"
import {
  inAppBrowserName,
  systemBrowserName,
  systemBrowserUrl,
} from "@/lib/in-app-browser"
import { ensureUserProfile } from "@/lib/user"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Mode = "login" | "register"

const noSubscribe = () => () => {}

/** The browser's user agent; null while server-rendering. */
function useUserAgent(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => navigator.userAgent,
    () => null
  )
}

async function copyCurrentLink() {
  const link = window.location.href
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    // in-app WebViews often lack the async clipboard API
    const field = document.createElement("textarea")
    field.value = link
    document.body.appendChild(field)
    field.select()
    const copied = document.execCommand("copy")
    field.remove()
    if (!copied) {
      toast.error("Không sao chép được link.")
      return
    }
  }
  toast.success("Đã sao chép link — dán vào trình duyệt để mở.")
}

/**
 * Shown in Zalo / Messenger / … where Google sign-in can't finish: what to do
 * if the "open in Chrome" button doesn't work.
 */
function InAppBrowserNotice({
  appName,
  browser,
}: {
  appName: string
  browser: string | null
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium">Bạn đang mở web trong {appName}</p>
      <p className="text-muted-foreground">
        Google không cho đăng nhập ngay trong {appName}. Bấm nút &quot;Mở bằng{" "}
        {browser ?? "trình duyệt"}&quot; bên dưới, web sẽ mở sang{" "}
        {browser ?? "trình duyệt"} rồi đăng nhập ở đó.
      </p>
      <p className="text-muted-foreground">
        Không mở được? Bấm dấu ⋯ ở góc trên bên phải, chọn &quot;Mở bằng trình
        duyệt&quot;, hoặc sao chép link rồi dán vào {browser ?? "trình duyệt"}.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={copyCurrentLink}
      >
        <CopyIcon />
        Sao chép link
      </Button>
    </div>
  )
}

export function LoginForm({
  className,
  redirectTo = "/dashboard",
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const userAgent = useUserAgent()
  const inAppName = userAgent ? inAppBrowserName(userAgent) : null
  const systemBrowser = userAgent ? systemBrowserName(userAgent) : null

  const isLogin = mode === "login"

  // a phone's redirect sign-in (handleGoogleSignIn) lands back on this page
  useEffect(() => {
    getGoogleRedirectResult()
      .then(async (credential) => {
        if (!credential) return
        await ensureUserProfile(credential.user)
        toast.success("Đăng nhập thành công")
        router.push(redirectTo)
      })
      .catch((error) => toast.error(getAuthErrorMessage(error)))
  }, [redirectTo, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const credential = isLogin
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password)
      await ensureUserProfile(credential.user)
      toast.success(isLogin ? "Đăng nhập thành công" : "Tạo tài khoản thành công")
      router.push(redirectTo)
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    // inside Zalo & co. the Google flow can't finish — reopen this same page
    // (with its ?redirect) in the system browser and sign in there
    const external =
      inAppName && userAgent
        ? systemBrowserUrl(new URL(window.location.href), userAgent)
        : null
    if (external) {
      window.location.href = external
      return
    }
    setLoading(true)
    if (systemBrowser) {
      // a phone: sign in in this same tab, not a popup
      try {
        await signInWithGoogleRedirect()
      } catch (error) {
        toast.error(getAuthErrorMessage(error))
        setLoading(false)
      }
      return
    }
    try {
      const credential = await signInWithGoogle()
      await ensureUserProfile(credential.user)
      toast.success("Đăng nhập thành công")
      router.push(redirectTo)
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Nhập email của bạn trước đã.")
      return
    }
    try {
      await resetPassword(email)
      toast.success("Đã gửi email đặt lại mật khẩu.")
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {isLogin ? "Welcome back" : "Tạo tài khoản"}
                </h1>
                <p className="text-balance text-muted-foreground">
                  {isLogin
                    ? "Đăng nhập vào tài khoản của bạn"
                    : "Đăng ký để bắt đầu sử dụng dashboard"}
                </p>
              </div>
              {inAppName ? (
                <InAppBrowserNotice appName={inAppName} browser={systemBrowser} />
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="ml-auto text-sm underline-offset-2 hover:underline"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading}>
                  {isLogin ? "Đăng nhập" : "Đăng ký"}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Hoặc tiếp tục với
              </FieldSeparator>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {inAppName && systemBrowser
                    ? `Mở bằng ${systemBrowser} để đăng nhập Google`
                    : "Đăng nhập với Google"}
                </Button>
              </Field>
              <FieldDescription className="text-center">
                {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => setMode(isLogin ? "register" : "login")}
                >
                  {isLogin ? "Đăng ký" : "Đăng nhập"}
                </button>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="relative hidden bg-muted md:block">
            <Image
              src="/logohem.png"
              alt="Image"
              fill
              priority
              className="object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Bằng việc tiếp tục, bạn đồng ý với <a href="#">Điều khoản dịch vụ</a>{" "}
        và <a href="#">Chính sách bảo mật</a>.
      </FieldDescription>
    </div>
  )
}
