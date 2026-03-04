"use client"; // needed for state/hooks

import { getStakingPosition, StakingPositionReponse } from "@/lib/config";
import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";

export default function StakingPage() {
  // States
  const [stakingPosition, setStakingPosition] = useState<StakingPositionReponse | null>(null);
  const [claimableRewards, setClaimableRewards] = useState(0);
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

  // Step 5 will add API calls here
  const handleStake = () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) {
      setStatus("Enter a valid amount to stake");
      return;
    }
    setStatus(`Staking ${stakeAmount} tokens...`);
    // Call API here later
  };

  const handleUnstake = () => {
    if (!unstakeAmount || Number(unstakeAmount) <= 0) {
      setStatus("Enter a valid amount to unstake");
      return;
    }
    setStatus(`Unstaking ${unstakeAmount} tokens...`);
    // Call API here later
  };

  const handleClaim = () => {
    setStatus("Claiming rewards...");
    // Call API here later
  };


 const handleStakeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { value } = e.target;

  // Allow empty string to let user clear input
  if (value === '' || !isNaN(Number(value))) {
    setStakeAmount(value);
  }
}


 const handleUnstakeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { value } = e.target;

  // Allow empty string to let user clear input
  if (value === '' || !isNaN(Number(value))) {
    setUnstakeAmount(value);
  }
}

console.log(stakeAmount, unstakeAmount)


  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Staking Dashboard</h1>

      {/* Balances */}
      <div className="mb-6">
        <p>
          Staked Balance:{" "}
          <strong>{Number(stakingPosition?.position.staked).toFixed(2) ?? 0}</strong> Tokens
        </p>
        <p>
          Claimable Rewards: <strong>{Number(stakingPosition?.position.claimable).toFixed(2)}</strong> Tokens
        </p>
      </div>

      {/* Stake Form */}
      <form className="mb-6 border p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Stake Tokens</h2>
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
      <form className="mb-6 border p-4 rounded-lg ">
        <h2 className="font-semibold mb-2">Unstake Tokens</h2>
        <input
          type="text"
          placeholder="Amount to unstake"
          value={unstakeAmount}
          onChange={handleUnstakeInput}
          className="border p-2 rounded mr-2"
        />

        <Button
         type="button"
          onClick={handleStake}
          className="border-3 border-foreground cursor-pointer  font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-foreground"
          variant={"destructive"}
        >
          Unstake Tokens
        </Button>
      </form>

      {/* Claim Rewards */}
      <div className="mb-6">

       <Button
         onClick={handleStake}
       className="border-3 border-foreground cursor-pointer  font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-foreground"
        variant={"default"}
       >
         Claim Rewards  </Button>
      </div>

      {/* Status */}
      <div>
        <p>Status: {status || "Idle"}</p>
      </div>
    </div>
  );
}
