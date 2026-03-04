"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestOtp, walletChallenge, walletVerify } from "@/lib/authApi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestOtp(email);
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    setError(null);
    setWalletLoading(true);

    try {
      if (typeof window === "undefined") {
        throw new Error("Wallet connection is only available in the browser");
      }

      const eth = (window as any).ethereum;
      if (!eth) {
        throw new Error("No wallet detected. Install MetaMask (or another wallet) to continue.");
      }

      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const address = accounts?.[0];
      if (!address) {
        throw new Error("No wallet address returned");
      }

      const challenge = await walletChallenge(address);
      const signature: string = await eth.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });

      const res = await walletVerify(address, signature);

      const roleRoutes: Record<string, string> = {
        tenant: "/dashboard/tenant",
        landlord: "/dashboard/landlord",
        agent: "/dashboard/agent",
      };
      router.push(roleRoutes[res.user.role] ?? "/dashboard/tenant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet login failed");
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block font-mono text-3xl font-black">
            SHELTA<span className="text-primary">FLEX</span>
          </Link>
          <p className="mt-2 text-muted-foreground">
            Welcome back! Enter your email to continue.
          </p>
        </div>

        <div className="border-3 border-foreground bg-card p-8 shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
          <h1 className="mb-6 font-mono text-2xl font-black">Sign In</h1>

          {error && (
            <div className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-mono text-sm font-bold"
              >
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="border-3 border-foreground py-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full border-3 border-foreground bg-primary px-8 py-6 text-lg font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="ml-2 h-5 w-5" />
              )}
              {loading ? "Sending OTP..." : "Continue"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="mb-4 text-center font-mono text-sm font-bold text-muted-foreground">
              Or
            </div>
            <Button
              type="button"
              onClick={handleConnectWallet}
              disabled={walletLoading}
              className="w-full border-3 border-foreground bg-card px-8 py-6 text-lg font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-60"
            >
              {walletLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : null}
              {walletLoading ? "Connecting..." : "Connect Wallet"}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-bold text-primary hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            By signing in, you agree to our{" "}
            <Link href="/terms-of-service" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}