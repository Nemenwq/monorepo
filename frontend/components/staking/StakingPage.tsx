"use client";

import { claimRewards, getStakingPosition, stakeTokens, StakingPositionReponse, unstakeTokens } from "@/lib/config";
import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { NgnStakingComponent } from "./NgnStakingComponent";

export default function StakingPage() {
  const [stakingPosition, setStakingPosition] = useState<StakingPositionReponse | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
      return;
    }

    getStakingPosition()
      .then((data) => setStakingPosition(data))
      .catch((err: Error) => {
        console.error("Failed to fatch staking position", err);
      });
  }, []);




  //  This function handles balance state in the staking page
  const updatePosition = (updates: {
    stakedDelta?: number
    claimableDelta?: number
  }) => {
    setStakingPosition((prev) => {
      if (!prev) return prev

      const currentStaked = Number(prev.position.staked)
      const currentClaimable = Number(prev.position.claimable)

      return {
        ...prev,
        position: {
          staked: (
            currentStaked + (updates.stakedDelta ?? 0)
          ).toFixed(6),
          claimable: (
            currentClaimable + (updates.claimableDelta ?? 0)
          ).toFixed(6),
        },
      }
    })
  }




  // Function to stake token
  const handleStake = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) {
      setStatus("Enter a valid amount to stake")
      return
    }

    const amount = Number(stakeAmount)

    try {
      setStatus("Submitting stake transaction...")

      const res = await stakeTokens(stakeAmount)

      if (res.status === "CONFIRMED") {
        setStatus("Stake confirmed on-chain")
      } else {
        setStatus("Stake queued for retry")
      }

      // Add to staked balance
      updatePosition({ stakedDelta: amount })

      setStakeAmount("")

    } catch (err: any) {
      setStatus(err.message || "Stake failed")
    }
  }




  //  Function to unstake token
  const handleUnstake = async () => {
    if (!unstakeAmount || Number(unstakeAmount) <= 0) {
      setStatus("Enter a valid amount to unstake")
      return
    }

    const amount = Number(unstakeAmount)

    try {
      setStatus("Submitting unstake transaction...")

      const res = await unstakeTokens(unstakeAmount)

      if (res.status === "CONFIRMED") {
        setStatus("Unstake confirmed on-chain")
      } else {
        setStatus("Unstake queued for retry")
      }

      // Subtract from staked
      updatePosition({ stakedDelta: -amount })

      setUnstakeAmount("")

    } catch (err: any) {
      setStatus(err.message || "Unstake failed")
    }
  }




  //  Function to claim token
  const handleClaim = async () => {
    try {
      setStatus("Claiming rewards...")

      const claimable = Number(stakingPosition?.position.claimable ?? 0)

      const res = await claimRewards()

      if (res.status === "CONFIRMED") {
        setStatus("Rewards claimed")
      } else {
        setStatus("Claim queued for retry")
      }

      // Remove claimable rewards
      updatePosition({ claimableDelta: -claimable })

    } catch (err: any) {
      setStatus(err.message || "Claim failed")
    }
  }


  const handleStakeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    // Allow empty string to let user clear input
    if (value === '' || !isNaN(Number(value))) {
      setStakeAmount(value);
    }
  };


  const handleUnstakeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    // Allow empty string to let user clear input
    if (value === '' || !isNaN(Number(value))) {
      setUnstakeAmount(value);
    }
  };




  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Staking Dashboard</h1>

      {/* Balances */}
      <div className="mb-6">
        <p>
          Staked Balance:{" "}
          <strong>
            {Number(stakingPosition?.position.staked ?? 0).toFixed(2)}
          </strong>
          Tokens
        </p>
        <p>
          Claimable Rewards: <strong> {Number(stakingPosition?.position.claimable ?? 0).toFixed(2)}</strong> Tokens
        </p>
      </div>

      {/* Staking Mode Tabs */}
      <Tabs defaultValue="ngn" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="ngn" className="font-semibold">
            NGN Staking (Default)
          </TabsTrigger>
          <TabsTrigger value="usdc" className="font-semibold">
            USDC Staking (Advanced)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ngn">
          <NgnStakingComponent />
        </TabsContent>

        <TabsContent value="usdc" className="space-y-6">
          {/* Stake Form */}
          <form className="border p-4 rounded-lg">
            <h2 className="font-semibold mb-2">Stake USDC Tokens</h2>
            <input
              type="text"
              placeholder="Amount to stake"
              value={stakeAmount}
              onChange={handleStakeInput}
              className="border p-2 rounded mr-2"
            />

            <Button
              type="button"
              onClick={handleStake}
              className="border-3 border-foreground cursor-pointer  font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-foreground"
              variant={"secondary"}
            >
              Stake
            </Button>
          </form>

          {/* Unstake Form */}
          <form className="border p-4 rounded-lg">
            <h2 className="font-semibold mb-2">Unstake USDC Tokens</h2>
            <input
              type="text"
              placeholder="Amount to unstake"
              value={unstakeAmount}
              onChange={handleUnstakeInput}
              className="border p-2 rounded mr-2"
            />

            <Button
              type="button"
              onClick={handleUnstake}
              className="border-3 border-foreground cursor-pointer  font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-foreground"
              variant={"destructive"}
            >
              Unstake Tokens
            </Button>
          </form>

          {/* Claim Rewards */}
          <div>
            <Button
              onClick={handleClaim}
              className="border-3 border-foreground cursor-pointer  font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-foreground"
              variant={"default"}
            >
              Claim Rewards
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Status */}
      <div>
        <p>Status: {status || "Idle"}</p>
      </div>
    </div>
  );
}
