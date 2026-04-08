import { Trophy, Users, Shuffle, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 px-4 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 flex justify-center">
            <Trophy className="h-12 w-12" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Tourney
          </h1>
          <p className="mt-4 text-lg text-blue-100">
            Americano tournament management with balanced, fair draws.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/auth/register"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow hover:bg-blue-50"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="rounded-lg border border-blue-400 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-text-primary">
            How It Works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={<Trophy className="h-6 w-6 text-blue-600" />}
              title="Create Tournament"
              description="Set up with rounds (3-5) and player slots (8-64)."
            />
            <Feature
              icon={<Users className="h-6 w-6 text-blue-600" />}
              title="Register Players"
              description="Add players with gender and skill classification."
            />
            <Feature
              icon={<Shuffle className="h-6 w-6 text-blue-600" />}
              title="Fair Draws"
              description="Balanced random pairing — same class never partners."
            />
            <Feature
              icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              title="Live Rankings"
              description="Real-time leaderboard with per-round scores."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-secondary">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}
