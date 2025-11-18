import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser
} from "@clerk/clerk-react";
import Dashboard from "./pages/Dashboard";
import { Button } from "./components/ui/button";

export default function App() {
  const { user } = useUser();
  const displayName = user?.fullName || user?.username || user?.firstName || "Guest";
  const email = user?.primaryEmailAddress?.emailAddress || "";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <header className="border-b border-white/10 bg-white/[0.03]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-4">
            <img src="/vite.svg" alt="Vite logo" className="h-10 w-10" />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
                Week 5 Lab
              </p>
              <h1 className="text-2xl font-semibold text-white">
                Meridian Chat &mdash; Static Edition
              </h1>
              <p className="text-sm text-slate-400">
                MERN · Clerk Authentication · Tailwind UI · REST messaging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="secondary">Sign in with Clerk</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-200">
                <span>{displayName}</span>
                <UserButton afterSignOutUrl="/" showName={false} />
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <SignedOut>
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 text-center text-slate-200">
            <h2 className="text-3xl font-semibold text-white">
              Welcome to Meridian Chat
            </h2>
            <p className="mt-3 text-base text-slate-400">
              Sign in to sync your Clerk profile and explore the static REST-based chat experience before we go live with Socket.IO.
            </p>
            <SignInButton mode="modal">
              <Button size="lg" className="mt-6">
                Sign in to continue
              </Button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <Dashboard
            currentUserId={user?.id}
            currentAvatar={user?.imageUrl}
            currentName={displayName}
            currentEmail={email}
          />
        </SignedIn>
      </main>
    </div>
  );
}