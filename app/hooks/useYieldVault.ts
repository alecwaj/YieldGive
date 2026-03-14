"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { useAccount } from "wagmi";
import {
  MOCK_YIELD_VAULT_ADDRESS,
  YIELD_VAULT_ABI,
} from "@/lib/contracts";

// Use mock vault address for hackathon demo
const ACTIVE_VAULT = MOCK_YIELD_VAULT_ADDRESS;

export function useYieldVault() {
  const { address } = useAccount();

  const { data: yieldAccrued, refetch: refetchYield } = useReadContract({
    address: ACTIVE_VAULT,
    abi: YIELD_VAULT_ABI,
    functionName: "getYieldAccrued",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 30_000,
    },
  });

  const { data: principal } = useReadContract({
    address: ACTIVE_VAULT,
    abi: YIELD_VAULT_ABI,
    functionName: "principalSnapshot",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: lastTrigger } = useReadContract({
    address: ACTIVE_VAULT,
    abi: YIELD_VAULT_ABI,
    functionName: "lastTrigger",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useWriteContract();

  return {
    yieldAccrued: yieldAccrued as bigint | undefined,
    principal: principal as bigint | undefined,
    lastTrigger: lastTrigger as bigint | undefined,
    refetchYield,
    deposit: (amount: bigint, adapter: `0x${string}`) =>
      writeContractAsync({
        address: ACTIVE_VAULT,
        abi: YIELD_VAULT_ABI,
        functionName: "deposit",
        args: [amount, adapter],
      }),
    withdraw: (amount: bigint) =>
      writeContractAsync({
        address: ACTIVE_VAULT,
        abi: YIELD_VAULT_ABI,
        functionName: "withdraw",
        args: [amount],
      }),
    setDonationConfig: (
      yieldPct: bigint,
      charities: `0x${string}`[],
      weights: bigint[]
    ) =>
      writeContractAsync({
        address: ACTIVE_VAULT,
        abi: YIELD_VAULT_ABI,
        functionName: "setDonationConfig",
        args: [yieldPct, charities, weights],
      }),
    triggerDonation: (user: `0x${string}`) =>
      writeContractAsync({
        address: ACTIVE_VAULT,
        abi: YIELD_VAULT_ABI,
        functionName: "triggerWeeklyDonation",
        args: [user],
      }),
  };
}
