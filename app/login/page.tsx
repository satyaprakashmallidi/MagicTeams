import { LoginForm } from '@/components/login/login-form'
import SignInCarousel from '@/components/login/signin-carousel'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Login Form */}
      <div className="flex-1">
        <LoginForm />
      </div>
      
      {/* Carousel */}
      <div className="flex-1">
        <SignInCarousel />
      </div>
    </div>
  )
}