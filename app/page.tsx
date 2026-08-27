import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#0B1F3A]">

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav className="absolute left-0 right-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">

          {/* Logo */}

          <Link
            href="/"
            className="text-lg font-semibold tracking-[0.2em]"
          >
            M &amp; O
          </Link>

          {/* Desktop Navigation */}

          <div className="hidden items-center gap-8 text-sm tracking-wide md:flex">

            <Link
              href="#story"
              className="transition hover:text-[#7A263A]"
            >
              OUR STORY
            </Link>

            <Link
              href="#details"
              className="transition hover:text-[#7A263A]"
            >
              DETAILS
            </Link>

            <Link
              href="/rsvp"
              className="transition hover:text-[#7A263A]"
            >
              RSVP
            </Link>

          </div>

        </div>
      </nav>


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">

        {/* Powder-blue decoration */}

        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#B9D7EA]/40" />

        {/* Wine decoration */}

        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[#7A263A]/10" />


        <div className="relative z-10 max-w-4xl text-center">

          <p className="mb-6 text-sm font-medium tracking-[0.35em] text-[#7A263A]">
            TOGETHER WITH THEIR FAMILIES
          </p>


          <h1 className="text-5xl font-light tracking-tight sm:text-7xl md:text-8xl">

            Modupeola

            <span className="mx-3 font-serif italic text-[#7A263A]">
              &
            </span>

            Oluwaseun

          </h1>


          <div className="mx-auto my-10 h-px w-24 bg-[#B9D7EA]" />


          <p className="text-lg tracking-[0.25em] text-[#0B1F3A]/80 sm:text-xl">
            ARE GETTING MARRIED
          </p>


          <p className="mt-8 text-base tracking-[0.2em] text-[#7A263A]">
            OCTOBER 30, 2026
          </p>


          <p className="mt-3 text-sm tracking-wide text-[#0B1F3A]/70">
            Osebosola Memorial Hall
            <br />
            FFF, Oka, Ondo City, Ondo State, Nigeria
          </p>


          {/* Main RSVP button */}

          <Link
            href="/rsvp"
            className="mt-10 inline-block border border-[#0B1F3A] px-10 py-4 text-sm font-medium tracking-[0.2em] transition duration-300 hover:bg-[#0B1F3A] hover:text-white"
          >
            RSVP
          </Link>

        </div>

      </section>


      {/* =====================================================
          STORY
      ===================================================== */}

      <section
        id="story"
        className="bg-[#F7FAFC] px-6 py-24 sm:py-32"
      >

        <div className="mx-auto max-w-3xl text-center">

          <p className="mb-4 text-xs font-semibold tracking-[0.3em] text-[#7A263A]">
            OUR STORY
          </p>


          <h2 className="text-4xl font-light sm:text-5xl">
            A beautiful beginning
          </h2>


          <div className="mx-auto my-8 h-px w-16 bg-[#B9D7EA]" />


          <p className="leading-8 text-[#0B1F3A]/70">
            Two lives, two journeys, and one beautiful story.
            We are grateful to celebrate this special moment
            surrounded by the people we love.
          </p>

        </div>

      </section>


      {/* =====================================================
          DETAILS
      ===================================================== */}

      <section
        id="details"
        className="px-6 py-24 sm:py-32"
      >

        <div className="mx-auto max-w-5xl">

          <div className="text-center">

            <p className="mb-4 text-xs font-semibold tracking-[0.3em] text-[#7A263A]">
              THE DAY
            </p>


            <h2 className="text-4xl font-light sm:text-5xl">
              Wedding Details
            </h2>

          </div>


          <div className="mt-16 grid gap-8 md:grid-cols-2">

            {/* Date */}

            <div className="border border-[#B9D7EA] p-10 text-center">

              <p className="text-xs font-semibold tracking-[0.3em] text-[#7A263A]">
                DATE
              </p>


              <h3 className="mt-5 text-2xl font-light">
                October 30, 2026
              </h3>

            </div>


            {/* Venue */}

            <div className="border border-[#B9D7EA] p-10 text-center">

              <p className="text-xs font-semibold tracking-[0.3em] text-[#7A263A]">
                VENUE
              </p>


              <h3 className="mt-5 text-2xl font-light">
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


      {/* =====================================================
          RSVP SECTION
      ===================================================== */}

      <section
        id="rsvp"
        className="bg-[#0B1F3A] px-6 py-24 text-white sm:py-32"
      >

        <div className="mx-auto max-w-2xl text-center">

          <p className="mb-4 text-xs font-semibold tracking-[0.3em] text-[#B9D7EA]">
            WE WOULD LOVE TO HAVE YOU
          </p>


          <h2 className="text-4xl font-light sm:text-5xl">
            Kindly RSVP
          </h2>


          <p className="mx-auto mt-6 max-w-lg leading-7 text-white/70">
            Your presence would mean so much to us.
            Please confirm your attendance so we can
            celebrate this special day together.
          </p>


          {/* REAL LINK TO RSVP PAGE */}

          <Link
            href="/rsvp"
            className="mt-10 inline-block border border-white px-10 py-4 text-sm font-medium tracking-[0.2em] transition duration-300 hover:bg-white hover:text-[#0B1F3A]"
          >
            RSVP NOW
          </Link>

        </div>

      </section>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="bg-white px-6 py-12">

        <div className="mx-auto max-w-5xl">

          <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">

            {/* Logo */}

            <Link
              href="/"
              className="text-sm tracking-[0.2em]"
            >
              M &amp; O
            </Link>


            {/* Footer Navigation */}

            <div className="flex flex-wrap justify-center gap-6 text-xs tracking-[0.15em] text-[#0B1F3A]/60">

              <Link
                href="/"
                className="transition hover:text-[#7A263A]"
              >
                HOME
              </Link>


              <Link
                href="#story"
                className="transition hover:text-[#7A263A]"
              >
                OUR STORY
              </Link>


              <Link
                href="#details"
                className="transition hover:text-[#7A263A]"
              >
                DETAILS
              </Link>


              <Link
                href="/rsvp"
                className="transition hover:text-[#7A263A]"
              >
                RSVP
              </Link>

            </div>


            <p className="text-xs text-[#0B1F3A]/50">
              October 30, 2026
            </p>

          </div>

        </div>

      </footer>

    </main>
  );
}