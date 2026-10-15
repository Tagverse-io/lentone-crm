'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { brand } from '@/brand.config';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { signIn, signInWithGoogle, user, loading, workspace, workspaceLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || workspaceLoading) return;
    if (user && workspace?.id) {
      router.replace('/dashboard');
    }
  }, [user, loading, workspace, workspaceLoading, router]);

  if (loading || workspaceLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed in successfully');
      // Navigation happens via useEffect once membership is loaded
    }
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed in with Google');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">{brand.appName.charAt(0)}</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{brand.appName}</h1>
          <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="rounded border-muted-foreground/30" />
                  Remember me
                </label>
                <a href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</a>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={googleBusy}>
              {googleBusy && <Loader2 size={16} className="mr-2 animate-spin" />}
              Continue with Google
            </Button>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a href="/register" className="text-primary hover:underline">Sign up</a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
