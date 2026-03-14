"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { CHARITY_REGISTRY_ADDRESS, CHARITY_REGISTRY_ABI } from "@/lib/contracts";

export function useCharityRegistry() {
  const { data: charities } = useReadContract({
    address: CHARITY_REGISTRY_ADDRESS,
    abi: CHARITY_REGISTRY_ABI,
    functionName: "getActiveCharities",
    query: { staleTime: 60_000 },
  });

  const { writeContractAsync } = useWriteContract();

  return {
    charities,
    addCharity: (charity: {
      name: string;
      category: string;
      wallet: `0x${string}`;
      metadataURI: string;
      active: boolean;
      addedAt: bigint;
    }) =>
      writeContractAsync({
        address: CHARITY_REGISTRY_ADDRESS,
        abi: CHARITY_REGISTRY_ABI,
        functionName: "addCharity",
        args: [charity],
      }),
  };
}
