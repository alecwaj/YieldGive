import { CharityCard } from "@/components/CharityCard";

async function getCharities() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public/charities.csv`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });
  } catch {
    return [];
  }
}

export default async function CharitiesPage() {
  const charities = await getCharities();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-8 py-4">
        <span className="font-bold text-green-700">YieldGive</span>
      </div>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Verified Charities
        </h1>
        <p className="text-gray-600 text-sm mb-8">
          {charities.length} organizations with verified on-chain activity,
          curated and scored by our AI research agents.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {charities.map((c: any) => (
            <CharityCard
              key={c.wallet_address}
              name={c.name}
              category={c.category}
              wallet={c.wallet_address}
              website={c.website}
              description={c.description}
              lastOnchainTx={c.last_onchain_tx}
            />
          ))}
        </div>
        {charities.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No charities yet. Check back soon.
          </div>
        )}
      </div>
    </main>
  );
}
