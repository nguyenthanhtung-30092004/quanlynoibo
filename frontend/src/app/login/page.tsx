import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center p-4 overflow-hidden">
      {/* 3D ambient light orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </main>
  );
}
