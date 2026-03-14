"use client";

import { formatDistanceToNow } from "date-fns";

interface CharityCardProps {
  name: string;
  category: string;
  wallet: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  lastOnchainTx?: string;
  totalReceived?: number;
  matchReason?: string;
  editable?: boolean;
  weight?: number;
  onWeightChange?: (pct: number) => void;
}

export function CharityCard({
  name,
  category,
  wallet,
  website,
  description,
  lastOnchainTx,
  matchReason,
  editable,
  weight,
  onWeightChange,
}: CharityCardProps) {
  const activityColor = lastOnchainTx
    ? (() => {
        const days =
          (Date.now() - new Date(lastOnchainTx).getTime()) /
          (1000 * 60 * 60 * 24);
        if (days < 30) return "bg-green-100 text-green-700";
        if (days < 180) return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
      })()
    : "bg-gray-100 text-gray-500";

  return (
    <div className="bg-white border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
          <span className="text-xs text-gray-500">{category}</span>
        </div>
        {lastOnchainTx && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${activityColor} whitespace-nowrap`}>
            {formatDistanceToNow(new Date(lastOnchainTx), { addSuffix: true })}
          </span>
        )}
      </div>

      {matchReason && (
        <p className="text-xs text-gray-600 italic">"{matchReason}"</p>
      )}

      {description && !matchReason && (
        <p className="text-xs text-gray-600 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center justify-between">
        <a
          href={`https://basescan.org/address/${wallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline font-mono"
        >
          {wallet.slice(0, 6)}...{wallet.slice(-4)}
        </a>
        {editable && onWeightChange && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={weight ?? 0}
              onChange={(e) => onWeightChange(Number(e.target.value))}
              className="w-14 border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        )}
      </div>
    </div>
  );
}
