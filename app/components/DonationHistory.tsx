"use client";

import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { formatUnits, parseAbiItem } from "viem";
import { MOCK_YIELD_VAULT_ADDRESS } from "@/lib/contracts";

interface DonationEvent {
  user: string;
  charity: string;
  amount: bigint;
  timestamp: bigint;
  txHash: string;
}

interface DonationHistoryProps {
  userAddress?: `0x${string}`;
}

export function DonationHistory({ userAddress }: DonationHistoryProps) {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicClient || !userAddress) return;

    setLoading(true);
    publicClient
      .getLogs({
        address: MOCK_YIELD_VAULT_ADDRESS,
        event: parseAbiItem(
          "event DonationExecuted(address indexed user, address indexed charity, uint256 amount, uint256 timestamp)"
        ),
        args: { user: userAddress },
        fromBlock: 0n,
        toBlock: "latest",
      })
      .then((logs) => {
        setEvents(
          logs.map((log) => ({
            user: log.args.user as string,
            charity: log.args.charity as string,
            amount: log.args.amount as bigint,
            timestamp: log.args.timestamp as bigint,
            txHash: log.transactionHash ?? "",
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [publicClient, userAddress]);

  return (
    <div className="bg-white border rounded-2xl p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Donation History</h2>
      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-sm text-gray-500">
          No donations yet. Donations are triggered weekly once you have a deposit and charity config.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="pb-2">Date</th>
              <th className="pb-2">Charity</th>
              <th className="pb-2 text-right">Amount</th>
              <th className="pb-2 text-right">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((e, i) => (
              <tr key={i}>
                <td className="py-2 text-gray-600">
                  {new Date(Number(e.timestamp) * 1000).toLocaleDateString()}
                </td>
                <td className="py-2 font-mono text-xs text-gray-700">
                  {e.charity.slice(0, 6)}...{e.charity.slice(-4)}
                </td>
                <td className="py-2 text-right font-medium text-green-700">
                  ${Number(formatUnits(e.amount, 6)).toFixed(4)}
                </td>
                <td className="py-2 text-right">
                  <a
                    href={`https://sepolia.basescan.org/tx/${e.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
