"use client";

import Link from "next/link";

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-[#f8f3ee] text-[#1d2638]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#7b1e3a]/10 bg-[#f8f3ee]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-serif text-xl tracking-[0.25em] text-[#7b1e3a]"
          >
            MJ SYMPHONY
          </Link>

          <Link
            href="/"
            className="rounded-full border border-[#7b1e3a]/30 px-5 py-2 text-sm tracking-[0.15em] text-[#7b1e3a] transition hover:bg-[#7b1e3a] hover:text-white"
          >
            BACK HOME
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-36">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[#b8d8e8]/30 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-[#7b1e3a]/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs font-medium tracking-[0.45em] text-[#7b1e3a]">
            OUR LOVE STORY
          </p>

          <h1 className="font-serif text-5xl leading-tight text-[#1d2638] md:text-7xl">
            The MJ Story
          </h1>

          <div className="mx-auto mt-7 h-px w-24 bg-[#7b1e3a]/40" />

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#1d2638]/70">
            How two people met, became friends, found love, and began writing
            a story that would become a lifetime.
          </p>

          <p className="mt-8 font-serif text-xl italic text-[#7b1e3a]">
            Modupeola & Oluwaseun
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="px-6 pb-24">
        <article className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-[#7b1e3a]/10 bg-white/70 px-7 py-10 shadow-[0_20px_70px_rgba(29,38,56,0.08)] md:px-14 md:py-16">
            <div className="space-y-8 text-[17px] leading-8 text-[#1d2638]/80">
              <p>
                Some stories begin with a grand gesture. Others begin quietly,
                almost unnoticed, and only make sense when you look back.
              </p>

              <p>
                Ours began at work.
              </p>

              <p>
                At first, there was nothing particularly extraordinary about
                it. We were simply two people going about our everyday lives,
                crossing paths and getting to know each other along the way.
              </p>

              <p>
                <span className="font-serif text-2xl italic text-[#7b1e3a]">
                  Me?
                </span>
              </p>

              <p>
                I certainly wasn't expecting anything. He was just another son
                of Adam.
              </p>

              <p>
                But somehow, gradually, things began to change.
              </p>

              <p>
                Conversations became more frequent. Familiarity turned into
                friendship, and friendship slowly became something deeper.
              </p>

              <p>
                There was no single moment when everything suddenly changed.
                Instead, it happened in the little things — the conversations,
                the laughter, the moments shared, and the growing realization
                that there was something special between us.
              </p>

              <blockquote className="my-12 border-l-4 border-[#7b1e3a] bg-[#f8f3ee] px-7 py-6 font-serif text-2xl italic leading-9 text-[#7b1e3a]">
                “He gradually became my person.”
              </blockquote>

              <p>
                What started as something simple became something meaningful.
                And what neither of us may have fully understood at the
                beginning was that we were building the foundation of
                something that would last far beyond those early days.
              </p>

              <p>
                We learned each other. We grew together. We laughed together.
                We supported each other through different seasons of life.
              </p>

              <p>
                Somewhere along the way, the person who was once just another
                face at work became a friend, then a companion, and eventually
                the person with whom I wanted to share my life.
              </p>

              <p>
                Looking back now, it is beautiful to see how something that
                seemed so ordinary at the beginning became one of the most
                extraordinary parts of our lives.
              </p>

              <p>
                It reminds us that sometimes the most beautiful stories don't
                announce themselves at the beginning. They unfold slowly,
                through ordinary moments that eventually become unforgettable
                memories.
              </p>

              <p>
                And now, the story that began at work is becoming a lifetime
                story.
              </p>

              <p>
                This is our story.
              </p>

              <p className="font-serif text-3xl text-[#7b1e3a]">
                The MJ Story.
              </p>

              <p className="font-serif text-xl italic">
                And this is only the beginning.
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* Wedding CTA */}
      <section className="border-y border-[#7b1e3a]/10 bg-[#1d2638] px-6 py-20 text-center text-white">
        <p className="text-xs tracking-[0.4em] text-[#b8d8e8]">
          THE NEXT CHAPTER
        </p>

        <h2 className="mt-5 font-serif text-4xl md:text-5xl">
          We are getting married!
        </h2>

        <p className="mx-auto mt-5 max-w-xl leading-7 text-white/70">
          And we would love for you to be there as we begin this beautiful
          new chapter together.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/#rsvp"
            className="rounded-full bg-[#b8d8e8] px-8 py-3 text-sm font-medium tracking-[0.15em] text-[#1d2638] transition hover:bg-white"
          >
            RSVP NOW
          </Link>

          <Link
            href="/"
            className="rounded-full border border-white/30 px-8 py-3 text-sm tracking-[0.15em] text-white transition hover:bg-white hover:text-[#1d2638]"
          >
            RETURN HOME
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#f8f3ee] px-6 py-10 text-center">
        <p className="font-serif text-xl tracking-[0.2em] text-[#7b1e3a]">
          MJ SYMPHONY
        </p>

        <p className="mt-3 text-sm text-[#1d2638]/60">
          Modupeola & Oluwaseun
        </p>

        <p className="mt-2 text-xs tracking-[0.15em] text-[#1d2638]/50">
          OCTOBER 30, 2026
        </p>
      </footer>
    </main>
  );
}