"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";

type TicketDisplay = {
  guestId: string;
  name: string;
  guestType: "Primary" | "Additional";
  ticketId: string;
  ticketNumber: string;
  qrToken: string;
  qrCode: string;
};

export default function RSVPPage() {
  const supabase = createClient();

  const invitationRefs = useRef<
    Record<string, HTMLDivElement | null>
  >({});

  const [attending, setAttending] =
    useState<"yes" | "no" | "">("");

  const [guestCount, setGuestCount] =
    useState(1);

  const [additionalGuestNames, setAdditionalGuestNames] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState("");

  const [primaryGuestName, setPrimaryGuestName] =
    useState("");

  const [tickets, setTickets] =
    useState<TicketDisplay[]>([]);

  function handleGuestCountChange(value: number) {
    setGuestCount(value);

    const additionalCount =
      Math.max(value - 1, 0);

    setAdditionalGuestNames((current) => {
      const updated = [...current];

      while (
        updated.length <
        additionalCount
      ) {
        updated.push("");
      }

      return updated.slice(
        0,
        additionalCount
      );
    });
  }

  function handleAdditionalGuestChange(
    index: number,
    value: string
  ) {
    setAdditionalGuestNames((current) => {
      const updated = [...current];
      updated[index] = value;
      return updated;
    });
  }

  async function createUniqueTicketNumber() {
    for (
      let attempt = 0;
      attempt < 20;
      attempt++
    ) {
      const number = Math.floor(
        100000 +
          Math.random() * 900000
      ).toString();

      return number;
    }

    throw new Error(
      "Unable to generate a ticket number."
    );
  }

  async function insertTicket(
    rsvpGuestId: string
  ) {
    for (
      let attempt = 0;
      attempt < 20;
      attempt++
    ) {
      const ticketNumber =
        await createUniqueTicketNumber();

      const qrToken =
        crypto.randomUUID();

      const {
        data,
        error,
      } = await supabase
        .from("tickets")
        .insert({
          rsvp_guest_id:
            rsvpGuestId,
          qr_token:
            qrToken,
          ticket_number:
            ticketNumber,
          checked_in:
            false,
        })
        .select(
          "id, qr_token, ticket_number"
        )
        .single();

      if (!error && data) {
        return data;
      }

      if (
        error?.code === "23505"
      ) {
        continue;
      }

      throw error;
    }

    throw new Error(
      "Unable to create a unique ticket. Please try again."
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setSuccess(false);
    setError("");

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    const firstName =
      formData
        .get("firstName")
        ?.toString()
        .trim() || "";

    const lastName =
      formData
        .get("lastName")
        ?.toString()
        .trim() || "";

    const email =
      formData
        .get("email")
        ?.toString()
        .trim() || "";

    const phone =
      formData
        .get("phone")
        ?.toString()
        .trim() || "";

    const mealPreference =
      formData
        .get("mealPreference")
        ?.toString() || null;

    const dietaryRequirements =
      formData
        .get("dietaryRequirements")
        ?.toString()
        .trim() || null;

    const message =
      formData
        .get("message")
        ?.toString()
        .trim() || null;

    if (!attending) {
      setError(
        "Please let us know whether you will be attending."
      );
      setLoading(false);
      return;
    }

    if (
      !firstName ||
      !lastName ||
      !email
    ) {
      setError(
        "Please complete your first name, last name, and email."
      );
      setLoading(false);
      return;
    }

    if (
      attending === "yes"
    ) {
      const incompleteGuest =
        additionalGuestNames.some(
          (name) =>
            !name.trim()
        );

      if (incompleteGuest) {
        setError(
          "Please provide the name of every additional guest."
        );
        setLoading(false);
        return;
      }
    }

    try {
      /*
       * ======================================================
       * STEP 1
       * Create the primary guest/contact.
       * ======================================================
       */

      const guestId =
        crypto.randomUUID();

      const {
        error: guestError,
      } = await supabase
        .from("guests")
        .insert({
          id: guestId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone:
            phone || null,
        });

      if (guestError) {
        throw guestError;
      }

      /*
       * ======================================================
       * STEP 2
       * Create the RSVP.
       * ======================================================
       */

      const {
        data: rsvp,
        error: rsvpError,
      } = await supabase
        .from("rsvps")
        .insert({
          guest_id:
            guestId,

          attending:
            attending === "yes",

          guest_count:
            attending === "yes"
              ? guestCount
              : 0,

          /*
           * Keep the old column populated
           * for compatibility.
           */
          additional_guest_names:
            attending === "yes"
              ? additionalGuestNames.join(
                  ", "
                )
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
        })
        .select("id")
        .single();

      if (rsvpError) {
        throw rsvpError;
      }

      if (!rsvp) {
        throw new Error(
          "Unable to create your RSVP."
        );
      }

      /*
       * ======================================================
       * DECLINING
       * ======================================================
       */

      if (
        attending === "no"
      ) {
        setPrimaryGuestName(
          `${firstName} ${lastName}`
        );

        setTickets([]);

        setSuccess(true);

        form.reset();

        setAttending("");

        setGuestCount(1);

        setAdditionalGuestNames([]);

        setTimeout(() => {
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }, 100);

        return;
      }

      /*
       * ======================================================
       * STEP 3
       * Build the list of individual people.
       * ======================================================
       */

      const people = [
        {
          name:
            `${firstName} ${lastName}`.trim(),

          guestType:
            "Primary" as const,
        },

        ...additionalGuestNames.map(
          (name) => ({
            name:
              name.trim(),

            guestType:
              "Additional" as const,
          })
        ),
      ];

      /*
       * ======================================================
       * STEP 4
       * Create one rsvp_guests row for EVERY person.
       * ======================================================
       */

      const createdTickets:
        TicketDisplay[] = [];

      for (
        const person of people
      ) {
        const {
          data: rsvpGuest,
          error:
            rsvpGuestError,
        } = await supabase
          .from("rsvp_guests")
          .insert({
            rsvp_id:
              rsvp.id,

            name:
              person.name,

            guest_type:
              person.guestType,

            /*
             * Table assignment is done
             * later by the organizers.
             */
            table_number:
              null,
          })
          .select(
            "id, name, guest_type"
          )
          .single();

        if (rsvpGuestError) {
          throw rsvpGuestError;
        }

        if (!rsvpGuest) {
          throw new Error(
            `Unable to create guest record for ${person.name}.`
          );
        }

        /*
         * ====================================================
         * STEP 5
         * Create ONE separate ticket for this person.
         * ====================================================
         */

        const ticket =
          await insertTicket(
            rsvpGuest.id
          );

        /*
         * ====================================================
         * STEP 6
         * Generate this person's QR code.
         * ====================================================
         */

        const ticketUrl =
          `${window.location.origin}/check-in?token=${ticket.qr_token}`;

        const generatedQRCode =
          await QRCode.toDataURL(
            ticketUrl,
            {
              width: 600,
              margin: 2,
              errorCorrectionLevel:
                "H",
            }
          );

        createdTickets.push({
          guestId:
            rsvpGuest.id,

          name:
            rsvpGuest.name,

          guestType:
            rsvpGuest.guest_type ===
            "Primary"
              ? "Primary"
              : "Additional",

          ticketId:
            ticket.id,

          ticketNumber:
            ticket.ticket_number,

          qrToken:
            ticket.qr_token,

          qrCode:
            generatedQRCode,
        });
      }

      /*
       * ======================================================
       * STEP 7
       * Display all individual tickets.
       * ======================================================
       */

      setPrimaryGuestName(
        `${firstName} ${lastName}`
      );

      setTickets(
        createdTickets
      );

      setSuccess(true);

      form.reset();

      setAttending("");

      setGuestCount(1);

      setAdditionalGuestNames([]);

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

  async function downloadTicket(
    ticket: TicketDisplay
  ) {
    const element =
      invitationRefs.current[
        ticket.guestId
      ];

    if (!element) {
      setError(
        "The invitation is not ready yet. Please try again."
      );
      return;
    }

    try {
      setError("");

      const dataUrl =
        await toPng(
          element,
          {
            cacheBust: true,
            pixelRatio: 3,
            backgroundColor:
              "#5f102b",
          }
        );

      const link =
        document.createElement(
          "a"
        );

      const safeGuestName =
        ticket.name
          .replace(
            /[^a-z0-9]/gi,
            "-"
          )
          .replace(
            /-+/g,
            "-"
          )
          .replace(
            /^-|-$/g,
            ""
          );

      link.download =
        `Modupeola-Oluwaseun-Ticket-${safeGuestName || "Guest"}-${ticket.ticketNumber}.png`;

      link.href =
        dataUrl;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

    } catch (
      downloadError
    ) {
      console.error(
        "Ticket download failed:",
        downloadError
      );

      setError(
        "We could not download this ticket. Please try again."
      );
    }
  }

  async function downloadAllTickets() {
    for (
      const ticket of tickets
    ) {
      await downloadTicket(
        ticket
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            350
          )
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#0b1f3a]">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <header className="border-b border-[#b9d7ea]/40 bg-white px-6 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">

          <a
            href="/"
            className="text-lg font-semibold tracking-[0.2em]"
          >
            MJ SYMPHONY
          </a>

          <a
            href="/"
            className="text-sm tracking-wide text-[#7a263a] transition hover:opacity-70"
          >
            BACK HOME
          </a>

        </div>
      </header>


      {/* ====================================================
          MAIN
      ==================================================== */}

      <section className="px-4 py-14 sm:px-6 sm:py-20">

        <div className="mx-auto max-w-4xl">

          {/* ==================================================
              FORM INTRO
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
                We would be delighted to celebrate
                this special day with you. Please let
                us know if you will be joining us.
              </p>

            </div>
          )}


          {/* ==================================================
              SUCCESS
          ================================================== */}

          {success && (
            <div>

              <div className="text-center">

                <p className="text-xs font-semibold tracking-[0.35em] text-[#7a263a]">
                  RSVP RECEIVED
                </p>

                <h1 className="mt-5 text-4xl font-light sm:text-5xl">
                  Thank You,{" "}
                  {primaryGuestName}
                </h1>

                <div className="mx-auto my-7 h-px w-16 bg-[#b9d7ea]" />

                {tickets.length > 0 ? (
                  <p className="mx-auto max-w-xl text-sm leading-7 text-[#0b1f3a]/65">
                    Your RSVP has been confirmed.
                    Each person in your party has
                    their own individual ticket and
                    check-in code.
                  </p>
                ) : (
                  <p className="mx-auto max-w-xl text-sm leading-7 text-[#0b1f3a]/65">
                    Thank you for letting us know.
                    We are sorry you will not be able
                    to join us, and we will celebrate
                    with you in spirit.
                  </p>
                )}

              </div>


              {/* ==================================================
                  INDIVIDUAL TICKETS
              ================================================== */}

              {tickets.length > 0 && (
                <div className="mt-12">

                  <div className="mb-8 text-center">

                    <p className="text-xs font-semibold tracking-[0.25em] text-[#7a263a]">
                      YOUR PARTY TICKETS
                    </p>

                    <p className="mt-3 text-sm text-[#0b1f3a]/55">
                      Please save or share each
                      person's ticket with them.
                    </p>

                  </div>


                  <div className="space-y-12">

                    {tickets.map(
                      (ticket) => (
                        <div
                          key={
                            ticket.ticketId
                          }
                          className="mx-auto w-full max-w-[760px]"
                        >

                          {/* ================================
                              DIGITAL INVITATION
                          ================================= */}

                          <div
                            ref={(element) => {
                              invitationRefs.current[
                                ticket.guestId
                              ] = element;
                            }}
                            className="luxury-card relative overflow-hidden"
                          >

                            {/* BORDERS */}

                            <div className="pointer-events-none absolute inset-[10px] border border-white/80" />

                            <div className="pointer-events-none absolute inset-[18px] border border-white/50" />


                            {/* ================================
                                TOP FLOWERS
                            ================================= */}

                            <img
                              src="/flowers.png"
                              alt=""
                              className="absolute left-[-35px] top-[-35px] z-10 w-[180px] opacity-95 sm:left-[-20px] sm:top-[-20px] sm:w-[210px]"
                            />

                            <img
                              src="/flowers.png"
                              alt=""
                              className="absolute right-[-45px] top-[-25px] z-10 w-[175px] -scale-x-100 opacity-90 sm:right-[-25px] sm:top-[-10px] sm:w-[205px]"
                            />


                            {/* ================================
                                BOTTOM TULIPS
                            ================================= */}

                            <img
                              src="/tulips.png"
                              alt=""
                              className="absolute bottom-[-10px] left-[-40px] z-10 w-[250px] opacity-95 sm:left-[-25px] sm:w-[285px]"
                            />

                            <img
                              src="/tulips.png"
                              alt=""
                              className="absolute bottom-[-10px] right-[-40px] z-10 w-[250px] -scale-x-100 opacity-95 sm:right-[-25px] sm:w-[285px]"
                            />


                            {/* ================================
                                ACTUAL MJ SYMPHONY MONOGRAM
                            ================================= */}

                            <div className="relative z-20 flex justify-center pt-14 sm:pt-16">

                              <img
                                src="/mj_symphony.png"
                                alt="MJ Symphony"
                                className="h-[190px] w-[190px] object-contain sm:h-[220px] sm:w-[220px]"
                              />

                            </div>


                            {/* ================================
                                FLOURISH
                            ================================= */}

                            <div className="relative z-20 mt-7 flex justify-center">

                              <div className="flourish">

                                <span />

                                <b>
                                  ◆
                                </b>

                                <span />

                              </div>

                            </div>


                            {/* ================================
                                COUPLE NAMES
                            ================================= */}

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


                            {/* ================================
                                DATE
                            ================================= */}

                            <div className="relative z-20 mt-7 text-center">

                              <div className="date-line">

                                <span />

                                <b>
                                  ◆
                                </b>

                                <span />

                              </div>

                              <p className="card-date">
                                OCTOBER 30, 2026
                              </p>

                            </div>


                            {/* ================================
                                VENUE
                            ================================= */}

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


                            {/* ================================
                                GUEST
                            ================================= */}

                            <div className="relative z-20 mx-auto mt-8 max-w-md px-6">

                              <div className="guest-panel">

                                <p className="guest-label">
                                  THIS INVITATION IS RESERVED FOR
                                </p>

                                <p className="guest-name">
                                  {ticket.name}
                                </p>

                                <p className="guest-count">
                                  {ticket.guestType.toUpperCase()}
                                </p>

                              </div>

                            </div>


                            {/* ================================
                                TICKET NUMBER
                            ================================= */}

                            <div className="relative z-20 mt-6 flex justify-center">

                              <div className="ticket-number-box">

                                <p className="ticket-label">
                                  INDIVIDUAL TICKET NUMBER
                                </p>

                                <p className="ticket-number">
                                  {ticket.ticketNumber}
                                </p>

                              </div>

                            </div>


                            {/* ================================
                                QR CODE
                            ================================= */}

                            <div className="relative z-20 mt-7 flex flex-col items-center px-6">

                              <div className="qr-frame">

                                <img
                                  src={
                                    ticket.qrCode
                                  }
                                  alt={`QR code for ${ticket.name}`}
                                  className="h-44 w-44 sm:h-52 sm:w-52"
                                />

                              </div>

                              <p className="qr-label">
                                SCAN OR ENTER TICKET NUMBER AT CHECK-IN
                              </p>

                            </div>


                            {/* ================================
                                BOTTOM ORNAMENT
                            ================================= */}

                            <div className="relative z-20 mt-8 flex justify-center">

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


                            {/* ================================
                                FOOTER
                            ================================= */}

                            <div className="relative z-20 px-6 pb-16 pt-7 text-center">

                              <p className="thank-you">
                                WE LOOK FORWARD TO CELEBRATING
                                <br />
                                WITH YOU
                              </p>

                            </div>

                          </div>


                          {/* ================================
                              DOWNLOAD
                          ================================= */}

                          <div className="mt-5 text-center">

                            <button
                              type="button"
                              onClick={() =>
                                downloadTicket(
                                  ticket
                                )
                              }
                              className="inline-flex items-center justify-center gap-3 bg-[#0b1f3a] px-7 py-3.5 text-xs font-medium tracking-[0.16em] text-white shadow-lg transition duration-300 hover:bg-[#7a263a]"
                            >

                              <span className="text-lg leading-none">
                                ↓
                              </span>

                              DOWNLOAD{" "}
                              {ticket.name.toUpperCase()}
                              'S TICKET

                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>


                  {/* DOWNLOAD ALL */}

                  {tickets.length > 1 && (
                    <div className="mt-12 text-center">

                      <button
                        type="button"
                        onClick={
                          downloadAllTickets
                        }
                        className="border border-[#0b1f3a]/20 bg-white px-8 py-4 text-xs font-medium tracking-[0.16em] text-[#0b1f3a] transition hover:border-[#7a263a] hover:text-[#7a263a]"
                      >
                        DOWNLOAD ALL PARTY TICKETS
                      </button>

                    </div>
                  )}

                </div>
              )}


              {error && (
                <div className="mx-auto mt-8 max-w-2xl border border-[#7a263a]/30 bg-[#7a263a]/5 p-4 text-center text-sm text-[#7a263a]">
                  {error}
                </div>
              )}

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

              {/* ==================================================
                  YOUR DETAILS
              ================================================== */}

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
                      autoComplete="given-name"
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
                      autoComplete="family-name"
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
                      autoComplete="email"
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
                      autoComplete="tel"
                      className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                      placeholder="Phone number"
                    />

                  </div>

                </div>

              </div>


              {/* ==================================================
                  ATTENDING
              ================================================== */}

              <div>

                <h2 className="text-sm font-semibold tracking-[0.2em] text-[#7a263a]">
                  WILL YOU BE JOINING US?
                </h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">

                  <button
                    type="button"
                    onClick={() =>
                      setAttending("yes")
                    }
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
                    onClick={() =>
                      setAttending("no")
                    }
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


              {/* ==================================================
                  ATTENDING DETAILS
              ================================================== */}

              {attending === "yes" && (
                <div className="space-y-8">

                  {/* NUMBER OF GUESTS */}

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
                      value={guestCount}
                      onChange={(event) =>
                        handleGuestCountChange(
                          Number(
                            event.target.value
                          )
                        )
                      }
                      className="w-full border-b border-[#0b1f3a]/25 bg-white px-1 py-3 outline-none focus:border-[#7a263a]"
                    >

                      <option value={1}>
                        1 guest
                      </option>

                      <option value={2}>
                        2 guests
                      </option>

                      <option value={3}>
                        3 guests
                      </option>

                      <option value={4}>
                        4 guests
                      </option>

                      <option value={5}>
                        5 guests
                      </option>

                    </select>

                    <p className="mt-2 text-xs text-[#0b1f3a]/45">
                      This includes you.
                    </p>

                  </div>


                  {/* ADDITIONAL GUESTS */}

                  {additionalGuestNames.length > 0 && (
                    <div>

                      <div className="mb-5">

                        <label className="block text-sm">
                          Additional Guest Names
                        </label>

                        <p className="mt-1 text-xs leading-5 text-[#0b1f3a]/45">
                          Each additional guest will
                          receive their own individual
                          ticket and check-in code.
                        </p>

                      </div>


                      <div className="space-y-5">

                        {additionalGuestNames.map(
                          (
                            name,
                            index
                          ) => (
                            <div
                              key={index}
                            >

                              <label
                                htmlFor={`additionalGuest-${index}`}
                                className="mb-2 block text-xs uppercase tracking-[0.12em] text-[#7a263a]"
                              >
                                Guest{" "}
                                {index + 2}
                              </label>

                              <input
                                id={`additionalGuest-${index}`}
                                type="text"
                                value={name}
                                onChange={(
                                  event
                                ) =>
                                  handleAdditionalGuestChange(
                                    index,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                required
                                className="w-full border-b border-[#0b1f3a]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7a263a]"
                                placeholder="Full name"
                              />

                            </div>
                          )
                        )}

                      </div>

                    </div>
                  )}


                  {/* MEAL */}

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

                      <option
                        value=""
                        disabled
                      >
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


                  {/* DIETARY */}

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


              {/* ==================================================
                  MESSAGE
              ================================================== */}

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
                    ? "CREATING YOUR TICKETS..."
                    : "SUBMIT RSVP"}
                </button>

                <p className="mt-5 text-xs text-[#0b1f3a]/45">
                  Your information will only be used
                  for wedding planning and attendance.
                </p>

              </div>

            </form>
          )}

        </div>

      </section>


      {/* ====================================================
          FOOTER
      ==================================================== */}

      <footer className="border-t border-[#b9d7ea]/40 bg-white px-6 py-8 text-center">

        <p className="text-sm tracking-[0.2em]">
          MJ SYMPHONY
        </p>

        <p className="mt-2 text-xs text-[#0b1f3a]/45">
          October 30, 2026 · Ondo State, Nigeria
        </p>

      </footer>


      {/* ====================================================
          STYLES
      ==================================================== */}

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
            0 25px 70px
            rgba(11, 31, 58, 0.22);

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
            clamp(
              42px,
              8vw,
              72px
            );

          font-weight: 400;

          letter-spacing:
            0.035em;

          line-height: 1.05;

          text-shadow:
            0 2px 3px
            rgba(0,0,0,0.18);
        }


        .card-and {
          font-family:
            Georgia,
            serif;

          font-size: 30px;

          line-height: 1;

          margin:
            7px 0;

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

          letter-spacing:
            0.15em;
        }


        .card-venue {
          font-size: 12px;

          font-weight: 600;

          letter-spacing:
            0.18em;

          margin: 0;
        }


        .card-location {
          font-size: 11px;

          letter-spacing:
            0.08em;

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

          padding:
            14px 10px;

          text-align: center;
        }


        .guest-label {
          margin: 0;

          font-size: 9px;

          letter-spacing:
            0.24em;

          opacity: 0.7;
        }


        .guest-name {
          margin-top: 7px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 23px;

          letter-spacing:
            0.04em;
        }


        .guest-count {
          margin-top: 5px;

          font-size: 9px;

          letter-spacing:
            0.22em;

          opacity: 0.7;
        }


        .ticket-number-box {
          min-width: 225px;

          padding:
            10px 22px 12px;

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

          letter-spacing:
            0.25em;

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

          letter-spacing:
            0.18em;
        }


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

          letter-spacing:
            0.16em;

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

          letter-spacing:
            0.22em;

          opacity: 0.65;
        }


        @media (max-width: 640px) {

          .luxury-card {
            min-height: 900px;
          }


          .card-name {
            font-size: 43px;
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