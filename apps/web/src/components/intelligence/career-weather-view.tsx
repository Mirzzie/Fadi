import { ArrowUpRight, CloudSun, Compass, Landmark, Newspaper, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CareerWeather, CareerWeatherCard, WeatherTag } from "@/lib/intelligence/career-weather";

const TAG_META: Record<WeatherTag, { label: string; cls: string }> = {
  pressure: { label: "Pressures your field", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  tailwind: { label: "Tailwind for your field", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  context: { label: "General force", cls: "border-border bg-muted/40 text-muted-foreground" },
  macro: { label: "Live", cls: "border-primary/40 bg-primary/10 text-primary" },
  news: { label: "Current affairs", cls: "border-border bg-muted/40 text-muted-foreground" },
};

export function CareerWeatherView({ weather }: { weather: CareerWeather }) {
  const role = weather.track.targetRole;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-4 sm:p-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <CloudSun className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Career Weather</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          What&apos;s moving in the world — geopolitics, the economy, your field — and the move{" "}
          <span className="text-foreground">you control</span> about each.{" "}
          {role ? (
            <>Read for <span className="text-foreground">{role}</span>.</>
          ) : (
            <>Set a career direction to personalize this.</>
          )}
        </p>
      </header>

      <Section icon={Compass} title="Forces shaping your field">
        {weather.forces.map((card, i) => (
          <WeatherCard key={i} card={card} />
        ))}
      </Section>

      <Section icon={Landmark} title="The economy right now">
        {weather.macroAvailable ? (
          weather.macro.map((card, i) => <WeatherCard key={i} card={card} />)
        ) : weather.macroConfigured ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            A <code className="rounded bg-muted px-1">FRED_API_KEY</code> is set, but the live fetch
            came back empty. Usually the key needs a restart to load, or it has stray quotes/spaces —
            it must be 32 lowercase letters/numbers. Restart the dev server and check the log line{" "}
            <code className="rounded bg-muted px-1">macro.fred.empty</code> (a <code>400</code> means
            the key was rejected). Get or check your key{" "}
            <a
              href="https://fredaccount.stlouisfed.org/apikeys"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline"
            >
              here
            </a>
            .
          </p>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Live inflation, interest rates and unemployment aren&apos;t connected yet. Add a free{" "}
            <a
              href="https://fredaccount.stlouisfed.org/apikeys"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline"
            >
              FRED API key
            </a>{" "}
            (set <code className="rounded bg-muted px-1">FRED_API_KEY</code>) to light up the money
            axis — what inflation and rates mean for your pay and targeting.
          </p>
        )}
      </Section>

      <Section icon={Newspaper} title="In the news for your field">
        {weather.currentAffairs.length > 0 ? (
          weather.currentAffairs.map((card, i) => <WeatherCard key={i} card={card} />)
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {role
              ? "Nothing field-specific cleared the bar from the live news sources right now — I won't manufacture headlines. Check back as signals refresh."
              : "Set a career direction and I'll surface the current affairs that actually touch your path."}
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Compass;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function WeatherCard({ card }: { card: CareerWeatherCard }) {
  const meta = TAG_META[card.tag];
  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">
          {card.kind === "macro" && <TrendingUp className="mr-1.5 inline size-4 text-primary" aria-hidden="true" />}
          {card.title}
        </h3>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem]", meta.cls)}>
          {meta.label}
        </span>
      </div>

      {card.whatsHappening ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{card.whatsHappening}</p>
      ) : null}
      {card.meaning ? (
        <p className="mt-1.5 text-sm text-foreground/90">
          <span className="text-muted-foreground">What it means: </span>
          {card.meaning}
        </p>
      ) : null}

      <p className="mt-2.5 rounded-md border-l-2 border-primary/50 bg-primary/5 py-1.5 pl-3 text-sm">
        <span className="font-medium text-primary">Your move: </span>
        {card.move}
      </p>

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {card.url ? (
          <a
            href={card.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Source <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        ) : null}
        {card.sources ? <span>{card.sources}</span> : null}
      </div>
    </article>
  );
}
