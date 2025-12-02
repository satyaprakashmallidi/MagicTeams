'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"
import { Icon } from "@/components/ui/icons"
import { agencyLogin, agencySignup } from "@/app/agency/[agencyId]/login/actions"
import Link from "next/link"
import { useRouter } from "next/navigation"

type ActionResult = { error?: string; success?: string } | undefined

interface WhitelabelLoginFormProps {
  agencyId: string
  agencyName?: string
  agencyLogoUrl?: string | null
}

export default function WhiteLabelLoginForm({ agencyId, agencyName, agencyLogoUrl }: WhitelabelLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Action functions for Server Actions
  const handleSignIn = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await agencyLogin(formData, agencyId) as ActionResult
      if (result?.error) {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login')
    } finally{
      setIsLoading(false);
    }
  }

  const handleSignUp = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const result = await agencySignup(formData, agencyId) as ActionResult
      if (result?.error) {
        setError(result.error)
  
      } else if (result?.success) {
        setSuccessMessage(result.success)
      } else {
        setSuccessMessage('Registration successful! Please check your email and confirm.')
        // Toggle to login mode after successful registration
        setTimeout(() => {
          setIsSignUp(false) // Switch to login mode
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration')
    } finally {
      setIsLoading(false);

    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          {agencyLogoUrl && (
            <div className="flex justify-center">
              <img
                src={agencyLogoUrl}
                alt={agencyName || 'Agency Logo'}
                className="h-16 w-auto rounded"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>
          )}
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isSignUp ? 'Create an account' : 'Welcome back'}
              {agencyName && ` to ${agencyName}`}
            </CardTitle>
          </div>
          <CardDescription>
            {isSignUp 
              ? 'Enter your email and password to create your account'
              : 'Enter your email and password to login to your account'}
          </CardDescription>
        </CardHeader>
        
        {error && (
          <div className="mx-6 mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mx-6 mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-md text-sm text-green-500">
            {successMessage}
          </div>
        )}
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          if (isSignUp) {
            handleSignUp(formData);
          } else {
            handleSignIn(formData);
          }
        }}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    asChild
                  >
                    <Link href={`/agency/${agencyId}/login/reset-password`}>Forgot password?</Link>
                  </Button>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>
            
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="w-full space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Icon name="loader2" className="mr-2 h-4 w-4 animate-spin" />
                    {isSignUp ? 'Signing up' : 'Signing in'}
                  </>
                ) : (
                  <>{isSignUp ? 'Sign up' : 'Sign in'}</>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={isLoading}
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </Button>
              
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}