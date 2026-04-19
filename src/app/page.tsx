import { Trophy, Users, Shuffle, BarChart3, Activity, Tv, Share2, Image } from "lucide-react";
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
            Americano tournaments and live tennis &amp; padel scoreboards — all in one app.
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

      {/* Americano Tournaments */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-text-primary">
            Americano Tournaments
          </h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            Create, manage, and share Americano doubles tournaments with fair draws.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={<Trophy className="h-6 w-6 text-blue-600" />}
              title="Create Tournament"
              description="Set up with 2-5 rounds and 8-32 player slots."
            />
            <Feature
              icon={<Users className="h-6 w-6 text-blue-600" />}
              title="Register Players"
              description="Add players with gender and skill classification (A+ to C)."
            />
            <Feature
              icon={<Shuffle className="h-6 w-6 text-blue-600" />}
              title="Fair Draws"
              description="Balanced random pairing — same class never partners, no repeats."
            />
            <Feature
              icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              title="Live Rankings"
              description="Real-time leaderboard with per-round scores. Share with players."
            />
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto w-full max-w-4xl border-t border-border-theme" />

      {/* Tennis & Padel Scoreboards */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-text-primary">
            Tennis &amp; Padel Scoreboards
          </h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            Live scoring for tennis and padel matches. Standard and junior formats supported.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={<Activity className="h-6 w-6 text-blue-600" />}
              title="Live Scoring"
              description="Tap to score — points, games, sets, and tiebreaks handled automatically."
            />
            <Feature
              icon={<Share2 className="h-6 w-6 text-blue-600" />}
              title="Share Live"
              description="Share a live link — spectators see scores update in real time."
            />
            <Feature
              icon={<Tv className="h-6 w-6 text-blue-600" />}
              title="TV Mode"
              description="Fullscreen mode for TVs and projectors with auto-scaling UI."
            />
            <Feature
              icon={<Image className="h-6 w-6 text-blue-600" />}
              title="Club Branding"
              description="Upload your club or event logo to display on live scoreboards."
            />
          </div>
        </div>
      </section>

      {/* Formats */}
      <section className="bg-surface-secondary px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-text-primary">
            Scoring Formats
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border-theme bg-surface p-6">
              <h3 className="font-semibold text-text-primary">Standard</h3>
              <p className="mt-2 text-sm text-text-secondary">
                6-game sets, tiebreak at 6-6 to 7 points. Best of 3 or 5 sets. Golden point (no-ad) optional.
              </p>
            </div>
            <div className="rounded-xl border border-border-theme bg-surface p-6">
              <h3 className="font-semibold text-text-primary">Junior</h3>
              <p className="mt-2 text-sm text-text-secondary">
                4-game sets, win by 2 at 3-3, tiebreak at 4-4. Super tiebreak to 10 in the final set.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-2xl font-bold text-text-primary">Ready to get started?</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Your first tournament and first scoreboard are free.
          </p>
          <div className="mt-6">
            <Link
              href="/auth/register"
              className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
            >
              Create Free Account
            </Link>
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
