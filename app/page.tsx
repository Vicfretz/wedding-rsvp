export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#0B1F3A]">
      {/* Navigation */}
      <nav className="absolute left-0 right-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6 sm:py-6">
          <div className="text-base font-semibold tracking-[0.2em] sm:text-lg">
            M & O
          </div>

          <div className="hidden items-center gap-8 text-sm tracking-wide md:flex">
            <a
              href="#story"
              className="transition-colors duration-300 hover:text-[#7A263A]"
            >
              OUR STORY
            </a>

            <a
              href="#details"
              className="transition-colors duration-300 hover:text-[#7A263A]"
            >
              DETAILS
            </a>

            <a
              href="#rsvp"
              className="transition-colors duration-300 hover:text-[#7A263A]"
            >
              RSVP
            </a>
          </div>

          {/* Mobile RSVP link */}
          <a
            href="#rsvp"
            className="text-xs font-medium tracking-[0.15em] text-[#7A263A] md:hidden"
          >
            RSVP
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-6 sm:pt-24">
        {/* Decorative powder-blue circle */}
        <div
          className="pointer-events-none absolute -right-40 -top-32 h-72 w-72 rounded-full bg-[#B9D7EA]/40 sm:-right-32 sm:-top-32 sm:h-96 sm:w-96"
          aria-hidden="true"
        />

        {/* Decorative wine circle */}
        <div
          className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#7A263A]/10 sm:h-96 sm:w-96"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
          <p className="mb-5 text-[10px] font-medium tracking-[0.25em] text-[#7A263A] sm:mb-6 sm:text-sm sm:tracking-[0.35em]">
            TOGETHER WITH THEIR FAMILIES
          </p>

          {/* Responsive Names */}
          <h1 className="font-light leading-[1.05] tracking-tight">
            <span className="block text-4xl sm:inline sm:text-6xl md:text-7xl lg:text-8xl">
              Modupeola
            </span>

            <span className="my-3 block font-serif text-3xl italic text-[#7A263A] sm:mx-3 sm:my-0 sm:inline sm:text-5xl md:text-6xl lg:text-7xl">
              &
            </span>

            <span className="block text-4xl sm:inline sm:text-6xl md:text-7xl lg:text-8xl">
              Oluwaseun
            </span>
          </h1>

          {/* Decorative divider */}
          <div className="mx-auto my-8 h-px w-16 bg-[#B9D7EA] sm:my-10 sm:w-24" />

          <p className="text-sm tracking-[0.18em] text-[#0B1F3A]/80 sm:text-lg sm:tracking-[0.25em] md:text-xl">
            ARE GETTING MARRIED
          </p>

          <p className="mt-7 text-sm tracking-[0.15em] text-[#7A263A] sm:mt-8 sm:text-base sm:tracking-[0.2em]">
            OCTOBER 30, 2026
          </p>

          <p className="mx-auto mt-3 max-w-md text-xs leading-6 tracking-wide text-[#0B1F3A]/70 sm:text-sm sm:leading-7">
            Osebosola Memorial Hall
            <br />
            FFF, Oka, Ondo City,
            <br className="sm:hidden" /> Ondo State, Nigeria
          </p>

          <a
            href="#rsvp"
            className="mt-8 inline-block border border-[#0B1F3A] px-8 py-3.5 text-xs font-medium tracking-[0.2em] transition duration-300 hover:bg-[#0B1F3A] hover:text-white sm:mt-10 sm:px-10 sm:py-4 sm:text-sm"
          >
            RSVP
          </a>
        </div>
      </section>

      {/* Story */}
      <section
        id="story"
        className="bg-[#F7FAFC] px-5 py-20 sm:px-6 sm:py-28 md:py-32"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-[10px] font-semibold tracking-[0.25em] text-[#7A263A] sm:text-xs sm:tracking-[0.3em]">
            OUR STORY
          </p>

          <h2 className="text-3xl font-light sm:text-4xl md:text-5xl">
            A beautiful beginning
          </h2>

          <div className="mx-auto my-7 h-px w-12 bg-[#B9D7EA] sm:my-8 sm:w-16" />

          <p className="text-sm leading-7 text-[#0B1F3A]/70 sm:text-base sm:leading-8">
            Two lives, two journeys, and one beautiful story. We are grateful
            to celebrate this special moment surrounded by the people we love.
          </p>
        </div>
      </section>

      {/* Details */}
      <section
        id="details"
        className="px-5 py-20 sm:px-6 sm:py-28 md:py-32"
      >
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="mb-4 text-[10px] font-semibold tracking-[0.25em] text-[#7A263A] sm:text-xs sm:tracking-[0.3em]">
              THE DAY
            </p>

            <h2 className="text-3xl font-light sm:text-4xl md:text-5xl">
              Wedding Details
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:mt-16 sm:gap-8 md:grid-cols-2">
            {/* Date */}
            <div className="border border-[#B9D7EA] p-7 text-center sm:p-10">
              <p className="text-[10px] font-semibold tracking-[0.25em] text-[#7A263A] sm:text-xs sm:tracking-[0.3em]">
                DATE
              </p>

              <h3 className="mt-4 text-xl font-light sm:mt-5 sm:text-2xl">
                October 30, 2026
              </h3>
            </div>

            {/* Venue */}
            <div className="border border-[#B9D7EA] p-7 text-center sm:p-10">
              <p className="text-[10px] font-semibold tracking-[0.25em] text-[#7A263A] sm:text-xs sm:tracking-[0.3em]">
                VENUE
              </p>

              <h3 className="mt-4 text-xl font-light sm:mt-5 sm:text-2xl">
                Osebosola Memorial Hall
              </h3>

              <p className="mt-3 text-sm leading-6 text-[#0B1F3A]/60">
                FFF, Oka, Ondo City,
                <br />
                Ondo State, Nigeria
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RSVP */}
      <section
        id="rsvp"
        className="bg-[#0B1F3A] px-5 py-20 text-white sm:px-6 sm:py-28 md:py-32"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[10px] font-semibold tracking-[0.25em] text-[#B9D7EA] sm:text-xs sm:tracking-[0.3em]">
            WE WOULD LOVE TO HAVE YOU
          </p>

          <h2 className="text-3xl font-light sm:text-4xl md:text-5xl">
            Kindly RSVP
          </h2>

          <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-white/70 sm:mt-6 sm:text-base sm:leading-7">
            Your presence would mean so much to us. Please confirm your
            attendance so we can celebrate this special day together.
          </p>

          <a
            href="/rsvp"
            className="mt-8 inline-block border border-white px-8 py-3.5 text-xs font-medium tracking-[0.2em] transition duration-300 hover:bg-white hover:text-[#0B1F3A] sm:mt-10 sm:px-10 sm:py-4 sm:text-sm"
          >
            RSVP NOW
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white px-5 py-8 text-center sm:px-6 sm:py-10">
        <p className="text-sm tracking-[0.2em] text-[#0B1F3A]">M & O</p>

        <p className="mt-3 text-xs text-[#0B1F3A]/50">
          October 30, 2026
        </p>
      </footer>
    </main>
  );
}