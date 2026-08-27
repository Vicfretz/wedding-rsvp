"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";

export default function RSVPPage() {
  const supabase = createClient();

  const invitationRef = useRef<HTMLDivElement>(null);

  const [attending, setAttending] = useState<"yes" | "no" | "">("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestCountConfirmed, setGuestCountConfirmed] = useState(0);
  const [qrCode, setQrCode] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  // ============================================================
  // GENERATE UNIQUE 6-DIGIT TICKET NUMBER
  // ============================================================

  async function generateUniqueTicketNumber() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const number = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      const { data, error } = await supabase
        .from("tickets")
        .select("id")
        .eq("ticket_number", number)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return number;
      }
    }

    throw new Error(
      "Unable to generate a unique ticket number. Please try again."
    );
  }

  // ============================================================
  // SUBMIT RSVP
  // ============================================================

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setSuccess(false);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const firstName =
      formData.get("firstName")?.toString().trim() || "";

    const lastName =
      formData.get("lastName")?.toString().trim() || "";

    const email =
      formData.get("email")?.toString().trim() || "";

    const phone =
      formData.get("phone")?.toString().trim() || "";

    const guestCount =
      Number(formData.get("guestCount")) || 1;

    const additionalGuests =
      formData
        .get("additionalGuests")
        ?.toString()
        .trim() || null;

    const mealPreference =
      formData.get("mealPreference")?.toString() || null;

    const dietaryRequirements =
      formData
        .get("dietaryRequirements")
        ?.toString()
        .trim() || null;

    const message =
      formData.get("message")?.toString().trim() || null;

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!attending) {
      setError(
        "Please let us know whether you will be attending."
      );
      setLoading(false);
      return;
    }

    if (!firstName || !lastName || !email) {
      setError(
        "Please complete your first name, last name, and email."
      );
      setLoading(false);
      return;
    }

    try {
      // ========================================================
      // CREATE UNIQUE GUEST ID
      // ========================================================

      const guestId = crypto.randomUUID();

      // ========================================================
      // SAVE GUEST
      // ========================================================

      const { error: guestError } = await supabase
        .from("guests")
        .insert({
          id: guestId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
        });

      if (guestError) {
        throw guestError;
      }

      // ========================================================
      // SAVE RSVP
      // ========================================================

      const { error: rsvpError } = await supabase
        .from("rsvps")
        .insert({
          guest_id: guestId,
          attending: attending === "yes",

          guest_count:
            attending === "yes"
              ? guestCount
              : 0,

          additional_guest_names:
            attending === "yes"
              ? additionalGuests
              : null,

          meal_preference:
            attending === "yes"
              ? mealPreference
              : null,

          dietary_requirements:
            attending === "yes"
              ? dietaryRequirements
              : null,

          message,
        });

      if (rsvpError) {
        throw rsvpError;
      }

      // ========================================================
      // CREATE TICKET
      // ========================================================

      if (attending === "yes") {
        // Generate secure QR token
        const ticketToken = crypto.randomUUID();

        // Generate unique 6-digit ticket number
        const newTicketNumber =
          await generateUniqueTicketNumber();

        // Save ticket
        const { error: ticketError } =
          await supabase
            .from("tickets")
            .insert({
              guest_id: guestId,
              qr_token: ticketToken,
              ticket_number: newTicketNumber,
            });

        if (ticketError) {
          throw ticketError;
        }

        // ======================================================
        // GENERATE QR CODE
        // ======================================================

        const ticketUrl =
          `${window.location.origin}/check-in?token=${ticketToken}`;

        const generatedQRCode =
          await QRCode.toDataURL(ticketUrl, {
            width: 600,
            margin: 2,
            errorCorrectionLevel: "H",
          });

        setQrCode(generatedQRCode);

        // ======================================================
        // SAVE TICKET NUMBER FOR DISPLAY
        // ======================================================

        setTicketNumber(newTicketNumber);

        setGuestCountConfirmed(guestCount);
      } else {
        setQrCode("");
        setTicketNumber("");
        setGuestCountConfirmed(0);
      }

      // ========================================================
      // PERSONALIZED GUEST NAME
      // ========================================================

      setGuestName(
        `${firstName} ${lastName}`
      );

      // ========================================================
      // SHOW DIGITAL INVITATION
      // ========================================================

      setSuccess(true);

      form.reset();
      setAttending("");

      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 100);

    } catch (err: any) {
      console.error(
        "RSVP submission error:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong while submitting your RSVP. Please try again."
      );

    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // DOWNLOAD DIGITAL INVITATION
  // ============================================================

  async function downloadDigitalInvitation() {
    if (!invitationRef.current) {
      setError(
        "Your invitation is not ready yet. Please try again."
      );
      return;
    }

    try {
      setError("");

      const dataUrl = await toPng(
        invitationRef.current,
        {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: "#5f102b",
        }
      );

      const link =
        document.createElement("a");

      const safeGuestName =
        guestName
          .replace(/[^a-z0-9]/gi, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

      link.download =
        `Modupeola-Oluwaseun-Digital-Invitation-${safeGuestName || "Guest"}.png`;

      link.href = dataUrl;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

    } catch (downloadError) {
      console.error(
        "Digital invitation download failed:",
        downloadError
      );

      setError(
        "We could not download your digital invitation. Please try again."
      );
    }
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#0b1f3a]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-[#b9d7ea]/40 bg-white px-6 py-6">

        <div className="mx-auto flex max-w-5xl items-center justify-between">

          <a
            href="/"
            className="text-lg font-semibold tracking-[0.2em]"
          >
            M & O
          </a>

          <a
            href="/"
            className="text-sm tracking-wide text-[#7a263a] transition hover:opacity-70"
          >
            BACK HOME
          </a>

        </div>

      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <section className="px-4 py-14 sm:px-6 sm:py-20">

        <div className="mx-auto max-w-3xl">

          {/* ==================================================
              PAGE TITLE
          ================================================== */}

          {!success && (

            <div className="text-center">

              <p className="text-xs font-semibold tracking-[0.35em] text-[#7a263a]">
                OCTOBER 30, 2026
              </p>

              <h1 className="mt-5 text-4xl font-light sm:text-5xl">
                Kindly RSVP
              </h1>

              <div className="mx-auto my-7 h-px w-16 bg-[#b9d7ea]" />

              <p className="mx-auto max-w-lg text-sm leading-7 text-[#0b1f3a]/65">
                We would be delighted to celebrate this
                special day with you. Please let us know if
                you will be joining us.
              </p>

            </div>

          )}


          {/* ==================================================
              PERSONALIZED DIGITAL INVITATION
          ================================================== */}

          {success && (

            <div className="flex justify-center">

              <div className="w-full max-w-[760px]">

                {/* ==================================================
                    INVITATION DOWNLOAD AREA
                ================================================== */}

                <div
                  ref={invitationRef}
                  className="luxury-card relative overflow-hidden"
                >

                  {/* OUTER DECORATIVE LINES */}

                  <div className="pointer-events-none absolute inset-[10px] border border-white/80" />

                  <div className="pointer-events-none absolute inset-[18px] border border-white/50" />


                  {/* ==================================================
                      MONOGRAM
                  ================================================== */}

                  <div className="relative z-20 flex justify-center pt-12 sm:pt-16">

                    <div className="monogram">

                      <div className="monogram-flower flower-top-left">
                        ❧
                      </div>

                      <div className="monogram-flower flower-top-right">
                        ❧
                      </div>

                      <div className="monogram-flower flower-bottom-left">
                        ❧
                      </div>

                      <div className="monogram-flower flower-bottom-right">
                        ❧
                      </div>

                      <div className="monogram-circle">

                        <div className="monogram-letter">
                          M
                        </div>

                        <div className="monogram-heart">
                          ♡
                        </div>

                        <div className="monogram-small">
                          Symphony
                        </div>

                      </div>

                    </div>

                  </div>


                  {/* ==================================================
                      TOP FLOURISH
                  ================================================== */}

                  <div className="relative z-20 mt-8 flex justify-center">

                    <div className="flourish">

                      <span />

                      <b>◆</b>

                      <span />

                    </div>

                  </div>


                  {/* ==================================================
                      COUPLE
                  ================================================== */}

                  <div className="relative z-20 px-6 pt-7 text-center">

                    <h1 className="card-name">
                      MODUPEOLA
                    </h1>

                    <div className="card-and">
                      &amp;
                    </div>

                    <h1 className="card-name">
                      OLUWASEUN
                    </h1>

                  </div>


                  {/* ==================================================
                      DATE
                  ================================================== */}

                  <div className="relative z-20 mt-7 text-center">

                    <div className="date-line">

                      <span />

                      <b>◆</b>

                      <span />

                    </div>

                    <p className="card-date">
                      OCTOBER 30, 2026
                    </p>

                  </div>


                  {/* ==================================================
                      VENUE
                  ================================================== */}

                  <div className="relative z-20 mt-4 px-6 text-center">

                    <p className="card-venue">
                      OSEBOSOLA MEMORIAL HALL
                    </p>

                    <p className="card-location">
                      FFF, OKA, ONDO CITY
                    </p>

                    <p className="card-location">
                      ONDO STATE, NIGERIA
                    </p>

                  </div>


                  {/* ==================================================
                      GUEST
                  ================================================== */}

                  <div className="relative z-20 mx-auto mt-8 max-w-md px-6">

                    <div className="guest-panel">

                      <p className="guest-label">
                        THIS INVITATION IS RESERVED FOR
                      </p>

                      <p className="guest-name">
                        {guestName}
                      </p>

                      {guestCountConfirmed > 0 && (

                        <p className="guest-count">

                          {guestCountConfirmed}{" "}

                          {guestCountConfirmed === 1
                            ? "GUEST"
                            : "GUESTS"}

                        </p>

                      )}

                    </div>

                  </div>


                  {/* ==================================================
                      TICKET NUMBER
                  ================================================== */}

                  {ticketNumber && (

                    <div className="relative z-20 mt-6 flex justify-center">

                      <div className="ticket-number-box">

                        <p className="ticket-label">
                          TICKET NUMBER
                        </p>

                        <p className="ticket-number">
                          {ticketNumber}
                        </p>

                      </div>

                    </div>

                  )}


                  {/* ==================================================
                      QR CODE
                  ================================================== */}

                  {qrCode && (

                    <div className="relative z-20 mt-7 flex flex-col items-center px-6">

                      <div className="qr-frame">

                        <img
                          src={qrCode}
                          alt="Unique wedding invitation QR code"
                          className="h-44 w-44 sm:h-52 sm:w-52"
                        />

                      </div>

                      <p className="qr-label">
                        SCAN OR ENTER TICKET NUMBER AT CHECK-IN
                      </p>

                    </div>

                  )}


                  {/* ==================================================
                      BOTTOM ORNAMENT
                  ================================================== */}

                  <div className="relative z-20 mt-9 flex justify-center">

                    <div className="bottom-ornament">

                      <span>
                        ❧
                      </span>

                      <div />

                      <span>
                        ❧
                      </span>

                    </div>

                  </div>


                  {/* ==================================================
                      THANK YOU
                  ================================================== */}

                  <div className="relative z-20 px-6 pb-14 pt-7 text-center">

                    <p className="thank-you">

                      WE LOOK FORWARD TO CELEBRATING

                      <br />

                      WITH YOU

                    </p>

                  </div>


                  {/* ==================================================
                      LEFT FLOWERS
                  ================================================== */}

                  <div className="floral-cluster floral-left">

                    <div className="flower flower-large burgundy">
                      <span />
                    </div>

                    <div className="flower flower-medium navy">
                      <span />
                    </div>

                    <div className="flower flower-small blue">
                      <span />
                    </div>

                    <div className="leaf leaf-one" />
                    <div className="leaf leaf-two" />
                    <div className="leaf leaf-three" />
                    <div className="leaf leaf-four" />

                  </div>


                  {/* ==================================================
                      RIGHT FLOWERS
                  ================================================== */}

                  <div className="floral-cluster floral-right">

                    <div className="flower flower-large burgundy">
                      <span />
                    </div>

                    <div className="flower flower-medium navy">
                      <span />
                    </div>

                    <div className="flower flower-small blue">
                      <span />
                    </div>

                    <div className="leaf leaf-one" />
                    <div className="leaf leaf-two" />
                    <div className="leaf leaf-three" />
                    <div className="leaf leaf-four" />

                  </div>

                </div>


                {/* ==================================================
                    DOWNLOAD BUTTON
                ================================================== */}

                <div className="mt-8 text-center">

                  <button
                    type="button"
                    onClick={downloadDigitalInvitation}
                    className="inline-flex items-center justify-center gap-3 bg-[#0b1f3a] px-8 py-4 text-sm font-medium tracking-[0.18em] text-white shadow-lg transition duration-300 hover:bg-[#7a263a]"
                  >

                    <span className="text-xl leading-none">
                      ↓
                    </span>

                    DOWNLOAD DIGITAL INVITATION

                  </button>

                  <p className="mx-auto mt-5 max-w-md text-xs leading-6 text-[#0b1f3a]/50">
                    Save your personalized invitation to
                    your phone and present the QR code or
                    ticket number when you arrive.
                  </p>

                </div>


                {/* ERROR */}

                {error && (

                  <div className="mt-5 border border-[#7a263a]/30 bg-[#7a263a]/5 p-4 text-center text-sm text-[#7a263a]">
                    {error}
                  </div>

                )}

              </div>

            </div>

          )}


          {/* ==================================================
              RSVP FORM
          ================================================== */}

          {!success && (

            <form
              onSubmit={handleSubmit}
              className="mt-14 space-y-10"
            >

              {/* PERSONAL DETAILS */}

              <div>

                <h2 className="text-sm font-semibold tracking-[0.2em] text-[#7a263a]">
                  YOUR DETAILS
                </h2>


                <div className="mt-6 grid gap-6 sm:grid-cols-2">

                  <div>

                    <label
                      htmlFor="firstName"
                      className="mb-2 block text-sm"
                    >
                      First Name
                    </label>

                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="First name"
                    />

                  </div>


                  <div>

                    <label
                      htmlFor="lastName"
                      className="mb-2 block text-sm"
                    >
                      Last Name
                    </label>

                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="Last name"
                    />

                  </div>

                </div>


                <div className="mt-6 grid gap-6 sm:grid-cols-2">

                  <div>

                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm"
                    >
                      Email
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="you@example.com"
                    />

                  </div>


                  <div>

                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm"
                    >
                      Phone
                    </label>

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="Phone number"
                    />

                  </div>

                </div>

              </div>


              {/* ATTENDANCE */}

              <div>

                <h2 className="text-sm font-semibold tracking-[0.2em] text-[#7a263a]">
                  WILL YOU BE JOINING US?
                </h2>


                <div className="mt-6 grid gap-4 sm:grid-cols-2">

                  <button
                    type="button"
                    onClick={() => setAttending("yes")}
                    className={`border p-5 text-left transition ${
                      attending === "yes"
                        ? "border-[#7a263a] bg-[#7a263a]/5"
                        : "border-[#b9d7ea] hover:border-[#7a263a]"
                    }`}
                  >

                    <span className="block text-lg">
                      Joyfully attending
                    </span>

                    <span className="mt-1 block text-sm text-[#0b1f3a]/55">
                      We can't wait to celebrate!
                    </span>

                  </button>


                  <button
                    type="button"
                    onClick={() => setAttending("no")}
                    className={`border p-5 text-left transition ${
                      attending === "no"
                        ? "border-[#7a263a] bg-[#7a263a]/5"
                        : "border-[#b9d7ea] hover:border-[#7a263a]"
                    }`}
                  >

                    <span className="block text-lg">
                      Regretfully declining
                    </span>

                    <span className="mt-1 block text-sm text-[#0b1f3a]/55">
                      We will miss you!
                    </span>

                  </button>

                </div>

              </div>


              {/* ATTENDING DETAILS */}

              {attending === "yes" && (

                <div className="space-y-8">

                  <div>

                    <label
                      htmlFor="guestCount"
                      className="mb-2 block text-sm"
                    >
                      Number of Guests
                    </label>

                    <select
                      id="guestCount"
                      name="guestCount"
                      defaultValue="1"
                      className="w-full border-b border-[#0b1f3a]/25 bg-white px-1 py-3 outline-none focus:border-[#7a263a]"
                    >

                      <option value="1">
                        1 guest
                      </option>

                      <option value="2">
                        2 guests
                      </option>

                      <option value="3">
                        3 guests
                      </option>

                      <option value="4">
                        4 guests
                      </option>

                      <option value="5">
                        5 guests
                      </option>

                    </select>

                  </div>


                  <div>

                    <label
                      htmlFor="additionalGuests"
                      className="mb-2 block text-sm"
                    >
                      Additional Guest Names
                    </label>

                    <input
                      id="additionalGuests"
                      name="additionalGuests"
                      type="text"
                      className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="Names of additional guests"
                    />

                  </div>


                  <div>

                    <label
                      htmlFor="mealPreference"
                      className="mb-2 block text-sm"
                    >
                      Meal Preference
                    </label>

                    <select
                      id="mealPreference"
                      name="mealPreference"
                      defaultValue=""
                      className="w-full border-b border-[#0b1f3a]/25 bg-white px-1 py-3 outline-none focus:border-[#7a263a]"
                    >

                      <option value="" disabled>
                        Select an option
                      </option>

                      <option value="regular">
                        Regular
                      </option>

                      <option value="vegetarian">
                        Vegetarian
                      </option>

                      <option value="other">
                        Other
                      </option>

                    </select>

                  </div>


                  <div>

                    <label
                      htmlFor="dietaryRequirements"
                      className="mb-2 block text-sm"
                    >
                      Dietary Requirements
                    </label>

                    <textarea
                      id="dietaryRequirements"
                      name="dietaryRequirements"
                      rows={3}
                      className="w-full resize-none border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="Please let us know about any dietary requirements."
                    />

                  </div>

                </div>

              )}


              {/* MESSAGE */}

              <div>

                <label
                  htmlFor="message"
                  className="mb-2 block text-sm"
                >
                  A Message for the Couple{" "}

                  <span className="text-[#0b1f3a]/40">
                    (optional)
                  </span>

                </label>

                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="w-full resize-none border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                  placeholder="Leave us a little note..."
                />

              </div>


              {/* ERROR */}

              {error && (

                <div className="border border-[#7a263a]/30 bg-[#7a263a]/5 p-5 text-center text-sm text-[#7a263a]">
                  {error}
                </div>

              )}


              {/* SUBMIT */}

              <div className="pt-2 text-center">

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#0b1f3a] px-12 py-4 text-sm font-medium tracking-[0.2em] text-white transition duration-300 hover:bg-[#7a263a] disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {loading
                    ? "CREATING YOUR INVITATION..."
                    : "SUBMIT RSVP"}

                </button>


                <p className="mt-5 text-xs text-[#0b1f3a]/45">
                  Your information will only be used for
                  wedding planning and attendance.
                </p>

              </div>

            </form>

          )}

        </div>

      </section>


      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="border-t border-[#b9d7ea]/40 bg-white px-6 py-8 text-center">

        <p className="text-sm tracking-[0.2em]">
          M & O
        </p>

        <p className="mt-2 text-xs text-[#0b1f3a]/45">
          October 30, 2026 · Ondo State, Nigeria
        </p>

      </footer>


      {/* ======================================================
          CSS
      ====================================================== */}

      <style jsx>{`

        .luxury-card {
          min-height: 980px;

          background:
            radial-gradient(
              circle at 50% 25%,
              rgba(130, 35, 62, 0.5),
              transparent 38%
            ),
            linear-gradient(
              145deg,
              #5f102b 0%,
              #781536 45%,
              #4d0c25 100%
            );

          color: white;

          box-shadow:
            0 25px 70px rgba(11, 31, 58, 0.22);

          position: relative;
        }


        .luxury-card::before {
          content: "";

          position: absolute;

          inset: 0;

          background-image:
            repeating-linear-gradient(
              115deg,
              rgba(255,255,255,0.018) 0px,
              rgba(255,255,255,0.018) 1px,
              transparent 1px,
              transparent 5px
            );

          pointer-events: none;
        }


        .monogram {
          position: relative;

          width: 190px;
          height: 190px;

          display: flex;

          align-items: center;
          justify-content: center;
        }


        .monogram-circle {
          position: relative;

          width: 150px;
          height: 150px;

          border: 2px solid rgba(255,255,255,0.95);

          border-radius: 45% 55% 50% 50%;

          display: flex;

          align-items: center;
          justify-content: center;

          transform: rotate(-2deg);

          box-shadow:
            inset 0 0 0 7px rgba(255,255,255,0.05);
        }


        .monogram-circle::before,
        .monogram-circle::after {
          content: "❧";

          position: absolute;

          color: white;

          font-size: 30px;
        }


        .monogram-circle::before {
          top: -28px;
          left: 58px;
        }


        .monogram-circle::after {
          bottom: -28px;
          left: 58px;

          transform: rotate(180deg);
        }


        .monogram-letter {
          position: absolute;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 100px;

          line-height: 1;

          font-weight: 500;

          transform: translateX(-8px);
        }


        .monogram-heart {
          position: absolute;

          font-family:
            Georgia,
            serif;

          font-size: 72px;

          left: 88px;
          top: 28px;

          transform: rotate(-8deg);
        }


        .monogram-small {
          position: absolute;

          bottom: 25px;

          left: 0;
          right: 0;

          text-align: center;

          font-family: cursive;

          font-size: 18px;

          transform: rotate(-5deg);
        }


        .monogram-flower {
          position: absolute;

          font-size: 35px;

          z-index: 5;
        }


        .flower-top-left {
          top: 2px;
          left: 15px;

          transform: rotate(-35deg);
        }


        .flower-top-right {
          top: 3px;
          right: 15px;

          transform:
            scaleX(-1)
            rotate(-35deg);
        }


        .flower-bottom-left {
          bottom: 0;
          left: 15px;

          transform: rotate(-145deg);
        }


        .flower-bottom-right {
          bottom: 0;
          right: 15px;

          transform:
            scaleX(-1)
            rotate(-145deg);
        }


        .flourish {
          display: flex;

          align-items: center;

          gap: 9px;
        }


        .flourish span {
          width: 75px;
          height: 1px;

          background:
            rgba(255,255,255,0.8);
        }


        .flourish b {
          font-size: 9px;
        }


        .card-name {
          margin: 0;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size:
            clamp(42px, 8vw, 72px);

          font-weight: 400;

          letter-spacing: 0.035em;

          line-height: 1.05;

          text-shadow:
            0 2px 3px rgba(0,0,0,0.18);
        }


        .card-and {
          font-family:
            Georgia,
            serif;

          font-size: 30px;

          line-height: 1;

          margin: 7px 0;

          opacity: 0.95;
        }


        .date-line {
          display: flex;

          justify-content: center;
          align-items: center;

          gap: 9px;
        }


        .date-line span {
          width: 70px;
          height: 1px;

          background:
            rgba(255,255,255,0.8);
        }


        .date-line b {
          font-size: 8px;
        }


        .card-date {
          margin-top: 12px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 19px;

          letter-spacing: 0.15em;
        }


        .card-venue {
          font-size: 12px;

          font-weight: 600;

          letter-spacing: 0.18em;

          margin: 0;
        }


        .card-location {
          font-size: 11px;

          letter-spacing: 0.08em;

          opacity: 0.78;

          margin-top: 4px;
        }


        .guest-panel {
          border-top:
            1px solid
            rgba(255,255,255,0.35);

          border-bottom:
            1px solid
            rgba(255,255,255,0.35);

          padding: 14px 10px;

          text-align: center;
        }


        .guest-label {
          margin: 0;

          font-size: 9px;

          letter-spacing: 0.24em;

          opacity: 0.7;
        }


        .guest-name {
          margin-top: 7px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 23px;

          letter-spacing: 0.04em;
        }


        .guest-count {
          margin-top: 5px;

          font-size: 9px;

          letter-spacing: 0.22em;

          opacity: 0.7;
        }


        /* =====================================================
           TICKET NUMBER
        ===================================================== */

        .ticket-number-box {
          min-width: 210px;

          padding: 10px 22px 12px;

          border:
            1px solid
            rgba(255,255,255,0.55);

          background:
            rgba(0,0,0,0.10);

          text-align: center;

          box-shadow:
            0 8px 20px
            rgba(0,0,0,0.12);
        }


        .ticket-label {
          margin: 0;

          font-size: 8px;

          font-weight: 600;

          letter-spacing: 0.25em;

          opacity: 0.68;
        }


        .ticket-number {
          margin-top: 4px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 27px;

          font-weight: 600;

          letter-spacing: 0.18em;
        }


        /* =====================================================
           QR
        ===================================================== */

        .qr-frame {
          background: white;

          padding: 11px;

          border:
            1px solid
            rgba(255,255,255,0.85);

          box-shadow:
            0 10px 25px
            rgba(0,0,0,0.22);
        }


        .qr-label {
          margin-top: 10px;

          max-width: 300px;

          font-size: 8px;

          letter-spacing: 0.16em;

          opacity: 0.72;

          text-align: center;

          line-height: 1.6;
        }


        .bottom-ornament {
          display: flex;

          align-items: center;

          gap: 12px;
        }


        .bottom-ornament span {
          font-size: 23px;

          opacity: 0.9;
        }


        .bottom-ornament div {
          width: 90px;

          height: 1px;

          background:
            rgba(255,255,255,0.6);
        }


        .thank-you {
          font-size: 9px;

          line-height: 1.8;

          letter-spacing: 0.22em;

          opacity: 0.65;
        }


        /* =====================================================
           FLOWERS
        ===================================================== */

        .floral-cluster {
          position: absolute;

          bottom: -15px;

          width: 260px;
          height: 390px;

          pointer-events: none;

          z-index: 5;
        }


        .floral-left {
          left: -45px;
        }


        .floral-right {
          right: -45px;

          transform:
            scaleX(-1);
        }


        .flower {
          position: absolute;

          border-radius: 50%;

          display: flex;

          align-items: center;
          justify-content: center;
        }


        .flower::before,
        .flower::after {
          content: "";

          position: absolute;

          border-radius: 50%;
        }


        .flower-large {
          width: 145px;
          height: 145px;

          left: 15px;
          bottom: 15px;
        }


        .flower-large::before {
          width: 65px;
          height: 145px;

          transform: rotate(45deg);
        }


        .flower-large::after {
          width: 65px;
          height: 145px;

          transform: rotate(-45deg);
        }


        .flower-medium {
          width: 95px;
          height: 95px;

          left: 100px;
          bottom: 120px;
        }


        .flower-medium::before {
          width: 42px;
          height: 95px;

          transform: rotate(45deg);
        }


        .flower-medium::after {
          width: 42px;
          height: 95px;

          transform: rotate(-45deg);
        }


        .flower-small {
          width: 70px;
          height: 70px;

          left: 38px;
          bottom: 175px;
        }


        .flower-small::before {
          width: 30px;
          height: 70px;

          transform: rotate(45deg);
        }


        .flower-small::after {
          width: 30px;
          height: 70px;

          transform: rotate(-45deg);
        }


        .burgundy {
          background: #7f163b;
        }


        .burgundy::before,
        .burgundy::after {
          background: #7f163b;
        }


        .navy {
          background: #0b2a4a;
        }


        .navy::before,
        .navy::after {
          background: #0b2a4a;
        }


        .blue {
          background: #8fb5d2;
        }


        .blue::before,
        .blue::after {
          background: #8fb5d2;
        }


        .flower span {
          width: 25px;
          height: 25px;

          border-radius: 50%;

          background: #d9b36c;

          z-index: 2;
        }


        /* =====================================================
           LEAVES
        ===================================================== */

        .leaf {
          position: absolute;

          width: 72px;
          height: 30px;

          background: #294f70;

          border-radius:
            100% 0 100% 0;

          transform: rotate(-35deg);
        }


        .leaf-one {
          left: 0;
          bottom: 210px;
        }


        .leaf-two {
          left: 120px;
          bottom: 205px;

          transform: rotate(25deg);
        }


        .leaf-three {
          left: 65px;
          bottom: 280px;

          transform: rotate(-65deg);
        }


        .leaf-four {
          left: 170px;
          bottom: 260px;

          transform: rotate(45deg);
        }


        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 640px) {

          .luxury-card {
            min-height: 900px;
          }


          .floral-cluster {
            transform: scale(0.72);

            transform-origin:
              bottom left;
          }


          .floral-right {
            transform:
              scaleX(-1)
              scale(0.72);

            transform-origin:
              bottom right;
          }


          .card-name {
            font-size: 43px;
          }


          .monogram {
            transform: scale(0.85);
          }


          .ticket-number-box {
            min-width: 190px;
          }


          .ticket-number {
            font-size: 24px;
          }

        }

      `}</style>

    </main>
  );
}