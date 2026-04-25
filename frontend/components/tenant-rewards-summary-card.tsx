"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStakingPosition, type StakingPositionReponse } from "@/lib/config";

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "loaded"; data: StakingPositionReponse }
  | { status: "error" };

function formatUsdc(amount: number): string {
  return `${amount.toFixed(2)} USDC`;
}

export function TenantRewardsSummaryCard() {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
      const timer = setTimeout(() => {
        setState({ status: "error" });
      }, 0);
      return () => clearTimeout(timer);
    }

    const loadingTimer = setTimeout(() => {
      setState({ status: "loading" });
    }, 0);

    getStakingPosition()
      .then((data) => {
        const timer = setTimeout(() => {
          setState({ status: "loaded", data });
        }, 0);
        return () => clearTimeout(timer);
      })
      .catch(() => {
        const timer = setTimeout(() => {
          setState({ status: "error" });
        }, 0);
        return () => clearTimeout(timer);
      });

    return () => clearTimeout(loadingTimer);
  }, []);

  const position = useMemo(() => {
    if (state.status !== "loaded") return null;

    const staked = Number(state.data.position.staked);
    const claimable = Number(state.data.position.claimable);
    const warming = Number(state.data.position.warming);
    const cooling = Number(state.data.position.cooling);

    return {
      staked,
      claimable,
      warming,
      cooling,
      hasAnyData: staked > 0 || claimable > 0 || warming > 0 || cooling > 0,
    };
  }, [state]);

  return (
    <Card className="border-3 border-foreground bg-secondary/10 p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border-3 border-foreground bg-secondary">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Staking Rewards</h3>
            <p className="text-sm text-muted-foreground">
              Summary of your current staking position.
            </p>
          </div>
        </div>

        <Link href="/staking">
          <Button className="border-2 border-foreground bg-background font-bold">
            View
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {state.status === "loading" && (
          <div className="sm:col-span-2 text-sm text-muted-foreground">
            Loading rewards...
          </div>
        )}

        {state.status === "error" && (
          <div className="sm:col-span-2 text-sm text-muted-foreground">
            Rewards data is unavailable.
          </div>
        )}

        {state.status === "loaded" && position && !position.hasAnyData && (
          <div className="sm:col-span-2 text-sm text-muted-foreground">
            You don’t have a staking position yet.
          </div>
        )}

        {state.status === "loaded" && position && position.hasAnyData && (
          <>
            <div className="rounded-md border-2 border-foreground bg-background p-4">
              <p className="text-sm text-muted-foreground">Claimable</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {formatUsdc(position.claimable)}
              </p>
            </div>

            <div className="rounded-md border-2 border-foreground bg-background p-4">
              <p className="text-sm text-muted-foreground">Staked</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {formatUsdc(position.staked)}
              </p>
            </div>

            <div className="rounded-md border-2 border-foreground bg-background p-4">
              <p className="text-sm text-muted-foreground">Warming</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {formatUsdc(position.warming)}
              </p>
            </div>

            <div className="rounded-md border-2 border-foreground bg-background p-4">
              <p className="text-sm text-muted-foreground">Cooling</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {formatUsdc(position.cooling)}
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
