import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type UserCredential,
} from "firebase/auth"

import { auth, googleProvider } from "@/lib/firebase"

export function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider)
}

export function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email)
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth)
}

/**
 * Turns a Firebase auth error code into a short, human-readable message.
 */
export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ""
  switch (code) {
    case "auth/invalid-email":
      return "Email không hợp lệ."
    case "auth/user-disabled":
      return "Tài khoản này đã bị vô hiệu hóa."
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email hoặc mật khẩu không đúng."
    case "auth/email-already-in-use":
      return "Email này đã được đăng ký."
    case "auth/weak-password":
      return "Mật khẩu phải có ít nhất 6 ký tự."
    case "auth/popup-closed-by-user":
      return "Cửa sổ đăng nhập đã bị đóng."
    case "auth/account-exists-with-different-credential":
      return "Email này đã đăng nhập bằng phương thức khác."
    default:
      return "Đã có lỗi xảy ra. Vui lòng thử lại."
  }
}
