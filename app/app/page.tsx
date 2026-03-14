import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b">
        <span className="font-bold text-xl text-green-700">YieldGive</span>
        <Link
          href="/onboard"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Your savings earn yield.
          <br />
          <span className="text-green-600">Your yield funds the world.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Deposit USDC into Morpho, earn ~5% APY, and automatically donate a
          portion of your yield to verified on-chain charities you believe in.
          Your principal is always safe.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/onboard"
            className="bg-green-600 text-white px-8 py-3 rounded-xl text-lg font-medium hover:bg-green-700"
          >
            Start Giving
          </Link>
          <Link
            href="/charities"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-xl text-lg font-medium hover:bg-gray-50"
          >
            Browse Charities
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Deposit USDC",
                desc: "Deposit into Morpho Blue on Base. Earn ~5% APY. Your principal is never at risk.",
              },
              {
                step: "2",
                title: "Set your split",
                desc: "Talk to our AI advisor. It recommends 3–4 charities that match your values and suggests a giving allocation.",
              },
              {
                step: "3",
                title: "Yield flows automatically",
                desc: "Every week, your configured % of yield is distributed to your chosen charities. No action needed.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
