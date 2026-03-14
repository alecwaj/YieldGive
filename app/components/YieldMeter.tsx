"use client";

import { formatUnits } from "viem";
import { useYieldVault } from "@/hooks/useYieldVault";

interface YieldMeterProps {
  userAddress?: `0x${string}`;
}

export function YieldMeter({ userAddress }: YieldMeterProps) {
  const { yieldAccrued, principal, lastTrigger } = useYieldVault();

  const yieldUSDC = yieldAccrued ? Number(formatUnits(yieldAccrued, 6)) : 0;
  const principalUSDC = principal ? Number(formatUnits(principal, 6)) : 0;
  const nextDonationDate = lastTrigger
    ? new Date(Number(lastTrigger) * 1000 + 7 * 24 * 60 * 60 * 1000)
    : null;
  const daysUntilDonation = nextDonationDate
    ? Math.max(
        0,
        Math.ceil(
          (nextDonationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const projectedAnnual = principalUSDC * 0.05 * 0.5;

  return (
    <div className="bg-white border rounded-2xl p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Your Yield</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-2xl font-bold text-green-600">
            ${yieldUSDC.toFixed(4)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Yield accrued</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            ${principalUSDC.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Principal deposited</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            ${projectedAnnual.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Projected annual donation</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {daysUntilDonation !== null ? `${daysUntilDonation}d` : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Until next donation</div>
        </div>
      </div>
    </div>
  );
}
