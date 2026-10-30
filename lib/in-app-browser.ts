/**
 * In-app browsers (Zalo, Messenger, Facebook, Instagram, TikTok, LINE, any
 * Android WebView) can't finish Google sign-in: Google refuses embedded
 * browsers, and Zalo hands the Google page over to Chrome, which then lacks
 * the state the in-app tab started with ("Unable to process request due to
 * missing initial state"). The login page detects them and sends the user to
 * the system browser instead.
 */
const IN_APP_BROWSERS: [RegExp, string][] = [
  [/Zalo/i, "Zalo"],
  [/Orca-Android|MessengerForiOS|MessengerLite/i, "Messenger"],
  [/FBAN|FBAV|FB_IAB|FB4A|FBIOS/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/\bLine\//, "LINE"],
  // any other Android app's WebView
  [/; wv\)/, "ứng dụng này"],
]

/** The in-app browser's name, or null in a real browser. */
export function inAppBrowserName(userAgent: string): string | null {
  for (const [pattern, name] of IN_APP_BROWSERS) {
    if (pattern.test(userAgent)) return name
  }
  return null
}

/** The system browser a user is sent to: Chrome on Android, Safari on iOS. */
export function systemBrowserName(userAgent: string): string | null {
  if (/Android/i.test(userAgent)) return "Chrome"
  if (/iPhone|iPad|iPod/.test(userAgent)) return "Safari"
  return null
}

/**
 * A link that opens `url` outside the in-app browser: a Chrome intent on
 * Android, Safari's `x-safari-` scheme on iOS (17+); null elsewhere.
 */
export function systemBrowserUrl(url: URL, userAgent: string): string | null {
  switch (systemBrowserName(userAgent)) {
    case "Chrome": {
      const scheme = url.protocol.slice(0, -1)
      const target = `${url.host}${url.pathname}${url.search}`
      return `intent://${target}#Intent;scheme=${scheme};package=com.android.chrome;end`
    }
    case "Safari":
      return `x-safari-${url.href}`
    default:
      return null
  }
}
