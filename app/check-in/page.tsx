"use client";

import { useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";

type TicketRow = {
  id: string;
  guest_id: string;
  ticket_number: string | null;
  qr_token: string;
  checked_in: boolean;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

type RSVP = {
  attending: boolean;
  guest_count: number;
  additional_guest_names: string | null;
  meal_preference: string | null;
  dietary_requirements: string | null;
  message: string | null;
};

type TicketInfo = {
  id: string;
  guest_id: string;
  ticket_number: string | null;
  qr_token: string;
  checked_in: boolean;
  guest: Guest | null;
  rsvp: RSVP | null;
};

export default function CheckInPage() {
  const supabase = createClient();

  // ============================================================
  // STATE
  // ============================================================

  const [scannerOpen, setScannerOpen] = useState(false);

  const [scannerLoading, setScannerLoading] =
    useState(false);

  const [scannerError, setScannerError] =
    useState("");

  const [ticketNumber, setTicketNumber] =
    useState("");

  const [ticket, setTicket] =
    useState<TicketInfo | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [checkingIn, setCheckingIn] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ============================================================
  // SCANNER REFS
  // ============================================================

  const scannerRef =
    useRef<Html5Qrcode | null>(null);

  const scannerRunningRef =
    useRef(false);

  const scannerStartingRef =
    useRef(false);

  const scanLockedRef =
    useRef(false);

  // ============================================================
  // GET GUEST + RSVP FOR A TICKET
  // ============================================================

  async function buildTicketInfo(
    ticketData: TicketRow
  ): Promise<TicketInfo | null> {
    // ----------------------------------------------------------
    // FIND GUEST
    // ----------------------------------------------------------

    const {
      data: guestData,
      error: guestError,
    } = await supabase
      .from("guests")
      .select(
        "id, first_name, last_name, email, phone"
      )
      .eq("id", ticketData.guest_id)
      .maybeSingle();

    console.log("Guest search:", {
      guestData,
      guestError,
    });

    if (guestError) {
      throw guestError;
    }

    if (!guestData) {
      setError(
        "This ticket exists, but it is not connected to a guest."
      );

      return null;
    }

    // ----------------------------------------------------------
    // FIND RSVP
    // ----------------------------------------------------------

    const {
      data: rsvpData,
      error: rsvpError,
    } = await supabase
      .from("rsvps")
      .select(
        `
        attending,
        guest_count,
        additional_guest_names,
        meal_preference,
        dietary_requirements,
        message
        `
      )
      .eq("guest_id", ticketData.guest_id)
      .maybeSingle();

    console.log("RSVP search:", {
      rsvpData,
      rsvpError,
    });

    if (rsvpError) {
      throw rsvpError;
    }

    return {
      id: ticketData.id,
      guest_id: ticketData.guest_id,
      ticket_number: ticketData.ticket_number,
      qr_token: ticketData.qr_token,
      checked_in: ticketData.checked_in,

      guest: guestData,

      rsvp: rsvpData,
    };
  }

  // ============================================================
  // FIND TICKET BY QR TOKEN
  // ============================================================

  async function loadTicketByToken(
    token: string
  ) {
    setLoading(true);
    setError("");
    setSuccess("");
    setTicket(null);

    try {
      // --------------------------------------------------------
      // FIND TICKET
      // --------------------------------------------------------

      const {
        data: ticketData,
        error: ticketError,
      } = await supabase
        .from("tickets")
        .select(
          `
          id,
          guest_id,
          ticket_number,
          qr_token,
          checked_in
          `
        )
        .eq("qr_token", token)
        .maybeSingle();

      console.log("QR ticket search:", {
        token,
        ticketData,
        ticketError,
      });

      if (ticketError) {
        throw ticketError;
      }

      if (!ticketData) {
        setError(
          "This wedding invitation is not valid."
        );

        return;
      }

      const ticketInfo =
        await buildTicketInfo(
          ticketData as TicketRow
        );

      if (!ticketInfo) {
        return;
      }

      setTicket(ticketInfo);

    } catch (err: any) {
      console.error(
        "QR ticket lookup error:",
        {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          error: err,
        }
      );

      setError(
        err?.message ||
          "We could not verify this wedding invitation."
      );

    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // VERIFY 6-DIGIT TICKET NUMBER
  // ============================================================

  async function verifyTicketNumber() {
    const code =
      ticketNumber.trim();

    // Clear previous state
    setError("");
    setSuccess("");
    setTicket(null);

    // ----------------------------------------------------------
    // VALIDATE SIX DIGITS
    // ----------------------------------------------------------

    if (!/^\d{6}$/.test(code)) {
      setError(
        "Please enter the 6-digit ticket number."
      );

      return;
    }

    setLoading(true);

    try {
      console.log(
        "Searching for ticket number:",
        code
      );

      // ========================================================
      // 1. FIND TICKET
      // ========================================================

      const {
        data: ticketData,
        error: ticketError,
      } = await supabase
        .from("tickets")
        .select(
          `
          id,
          guest_id,
          ticket_number,
          qr_token,
          checked_in
          `
        )
        .eq("ticket_number", code)
        .maybeSingle();

      // Very useful for debugging
      console.log(
        "Ticket number search result:",
        {
          code,
          ticketData,
          ticketError,
        }
      );

      // --------------------------------------------------------
      // SUPABASE ERROR
      // --------------------------------------------------------

      if (ticketError) {
        console.error(
          "Ticket number database error:",
          {
            message: ticketError.message,
            details: ticketError.details,
            hint: ticketError.hint,
            code: ticketError.code,
          }
        );

        throw ticketError;
      }

      // --------------------------------------------------------
      // TICKET DOES NOT EXIST
      // --------------------------------------------------------

      if (!ticketData) {
        setError(
          `No invitation was found with ticket number ${code}.`
        );

        return;
      }

      // ========================================================
      // 2. FIND GUEST + RSVP
      // ========================================================

      const ticketInfo =
        await buildTicketInfo(
          ticketData as TicketRow
        );

      if (!ticketInfo) {
        return;
      }

      // ========================================================
      // 3. SAVE RESULT
      // ========================================================

      setTicket(ticketInfo);

      console.log(
        "Verified ticket:",
        ticketInfo
      );

    } catch (err: any) {
      console.error(
        "Ticket number verification FAILED:",
        {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          error: err,
        }
      );

      setError(
        err?.message ||
          "Something went wrong while verifying the ticket."
      );

    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // CHECK GUEST IN
  // ============================================================

  async function handleCheckIn() {
    if (!ticket) {
      return;
    }

    setCheckingIn(true);
    setError("");
    setSuccess("");

    try {
      // --------------------------------------------------------
      // CHECK RSVP
      // --------------------------------------------------------

      if (
        ticket.rsvp &&
        ticket.rsvp.attending === false
      ) {
        setError(
          "This guest declined the invitation and cannot be checked in."
        );

        return;
      }

      // --------------------------------------------------------
      // ALREADY CHECKED IN
      // --------------------------------------------------------

      if (ticket.checked_in === true) {
        setError(
          "This guest has already been checked in."
        );

        return;
      }

      // ========================================================
      // UPDATE TICKET
      // ========================================================

      const {
        data: updatedTicket,
        error: updateError,
      } = await supabase
        .from("tickets")
        .update({
          checked_in: true,
        })
        .eq("id", ticket.id)
        .eq("checked_in", false)
        .select(
          `
          id,
          guest_id,
          ticket_number,
          qr_token,
          checked_in
          `
        )
        .maybeSingle();

      console.log(
        "Check-in response:",
        {
          updatedTicket,
          updateError,
        }
      );

      // --------------------------------------------------------
      // UPDATE ERROR
      // --------------------------------------------------------

      if (updateError) {
        throw updateError;
      }

      // --------------------------------------------------------
      // NOTHING UPDATED
      // --------------------------------------------------------

      if (!updatedTicket) {
        // Check whether somebody already checked it in

        const {
          data: currentTicket,
          error: currentError,
        } = await supabase
          .from("tickets")
          .select(
            `
            id,
            guest_id,
            ticket_number,
            qr_token,
            checked_in
            `
          )
          .eq("id", ticket.id)
          .maybeSingle();

        if (currentError) {
          throw currentError;
        }

        if (
          currentTicket?.checked_in === true
        ) {
          setTicket({
            ...ticket,
            checked_in: true,
          });

          setError(
            "This guest has already been checked in."
          );

          return;
        }

        setError(
          "The guest could not be checked in. Please try again."
        );

        return;
      }

      // ========================================================
      // SUCCESS
      // ========================================================

      setTicket({
        ...ticket,
        checked_in: true,
      });

      setSuccess(
        "Guest checked in successfully!"
      );

    } catch (err: any) {
      console.error(
        "Check-in error:",
        {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          error: err,
        }
      );

      setError(
        err?.message ||
          "We could not complete the check-in."
      );

    } finally {
      setCheckingIn(false);
    }
  }

  // ============================================================
  // START QR SCANNER
  // ============================================================

  async function startScanner() {
    if (
      scannerRunningRef.current ||
      scannerStartingRef.current
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setScannerError("");
    setTicket(null);
    setScannerOpen(true);
    setScannerLoading(true);

    scanLockedRef.current = false;
    scannerStartingRef.current = true;

    try {
      // Give React time to render qr-reader
      await new Promise((resolve) =>
        setTimeout(resolve, 200)
      );

      // --------------------------------------------------------
      // CLEAN UP OLD SCANNER
      // --------------------------------------------------------

      if (scannerRef.current) {
        try {
          if (
            scannerRunningRef.current
          ) {
            await scannerRef.current.stop();
          }
        } catch {}

        try {
          scannerRef.current.clear();
        } catch {}

        scannerRef.current = null;
        scannerRunningRef.current = false;
      }

      // --------------------------------------------------------
      // CREATE SCANNER
      // --------------------------------------------------------

      const scanner =
        new Html5Qrcode("qr-reader");

      scannerRef.current = scanner;

      // ========================================================
      // START CAMERA
      // ========================================================

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,

          qrbox: {
            width: 250,
            height: 250,
          },

          aspectRatio: 1,

          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        },

        // ======================================================
        // QR DETECTED
        // ======================================================

        async (decodedText) => {
          console.log(
            "QR code detected:",
            decodedText
          );

          if (
            scanLockedRef.current
          ) {
            return;
          }

          scanLockedRef.current = true;

          scannerRunningRef.current = false;

          // Stop camera immediately
          try {
            await scanner.stop();
          } catch {}

          try {
            scanner.clear();
          } catch {}

          scannerRef.current = null;

          setScannerOpen(false);
          setScannerLoading(false);

          // ====================================================
          // EXTRACT TOKEN
          // ====================================================

          let qrToken =
            decodedText.trim();

          try {
            const scannedUrl =
              new URL(decodedText);

            const urlToken =
              scannedUrl.searchParams.get(
                "token"
              );

            if (urlToken) {
              qrToken = urlToken;
            }
          } catch {
            // QR contains token directly
          }

          if (!qrToken) {
            setError(
              "The QR code does not contain a valid invitation token."
            );

            scanLockedRef.current =
              false;

            return;
          }

          // ====================================================
          // VERIFY QR TICKET
          // ====================================================

          await loadTicketByToken(
            qrToken
          );
        },

        // ======================================================
        // SCAN ERRORS
        // ======================================================

        (_errorMessage) => {
          // Ignore normal scanner errors.
        }
      );

      scannerRunningRef.current = true;
      setScannerLoading(false);

    } catch (err: any) {
      console.error(
        "Camera scanner error:",
        {
          message: err?.message,
          name: err?.name,
          error: err,
        }
      );

      scannerRunningRef.current =
        false;

      setScannerLoading(false);

      if (
        err?.name ===
        "NotAllowedError"
      ) {
        setScannerError(
          "Camera permission was denied. Please allow camera access and try again."
        );
      } else if (
        err?.name ===
        "NotFoundError"
      ) {
        setScannerError(
          "No camera was found on this device."
        );
      } else {
        setScannerError(
          "We could not start the camera. Please make sure your browser has permission to use the camera."
        );
      }

    } finally {
      scannerStartingRef.current =
        false;
    }
  }

  // ============================================================
  // STOP SCANNER
  // ============================================================

  async function stopScanner() {
    if (!scannerRef.current) {
      setScannerOpen(false);
      setScannerLoading(false);
      return;
    }

    try {
      if (
        scannerRunningRef.current
      ) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      console.warn(
        "Could not stop scanner:",
        err
      );
    }

    scannerRunningRef.current =
      false;

    scannerStartingRef.current =
      false;

    try {
      scannerRef.current.clear();
    } catch {}

    scannerRef.current = null;

    setScannerOpen(false);
    setScannerLoading(false);
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetCheckIn() {
    void stopScanner();

    setTicket(null);
    setTicketNumber("");

    setError("");
    setSuccess("");
    setScannerError("");

    setLoading(false);
    setCheckingIn(false);

    scanLockedRef.current =
      false;
  }

  // ============================================================
  // CLEAN UP CAMERA
  // ============================================================

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch {}

        try {
          scannerRef.current.clear();
        } catch {}
      }

      scannerRef.current = null;
      scannerRunningRef.current =
        false;
      scannerStartingRef.current =
        false;
    };
  }, []);

  // ============================================================
  // GUEST NAME
  // ============================================================

  const guestName =
    ticket?.guest
      ? `${ticket.guest.first_name} ${ticket.guest.last_name}`
      : "";

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#0b1f3a]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-[#b9d7ea]/50 bg-white">

        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">

          <div>

            <p className="text-lg font-semibold tracking-[0.2em]">
              M &amp; O
            </p>

            <p className="mt-1 text-[10px] tracking-[0.25em] text-[#7a263a]">
              MODUPEOLA &amp; OLUWASEUN
            </p>

          </div>

          <div className="text-right">

            <p className="text-xs font-semibold tracking-[0.2em] text-[#7a263a]">
              EVENT CHECK-IN
            </p>

            <p className="mt-1 text-xs text-[#0b1f3a]/50">
              October 30, 2026
            </p>

          </div>

        </div>

      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <section className="px-5 py-12 sm:px-6 sm:py-16">

        <div className="mx-auto max-w-2xl">

          {/* ==================================================
              TITLE
          ================================================== */}

          <div className="text-center">

            <p className="text-xs font-semibold tracking-[0.35em] text-[#7a263a]">
              GUEST ARRIVAL
            </p>

            <h1 className="mt-4 text-4xl font-light sm:text-5xl">
              Wedding Check-In
            </h1>

            <div className="mx-auto my-6 h-px w-16 bg-[#b9d7ea]" />

            <p className="mx-auto max-w-md text-sm leading-7 text-[#0b1f3a]/60">
              Scan the guest&apos;s QR code
              or enter their 6-digit ticket
              number to verify their
              invitation.
            </p>

          </div>


          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (

            <div className="mt-8 border border-[#7a263a]/30 bg-[#7a263a]/5 p-5 text-center">

              <p className="text-sm font-medium text-[#7a263a]">
                {error}
              </p>

            </div>

          )}


          {/* ==================================================
              SUCCESS
          ================================================== */}

          {success && (

            <div className="mt-8 border border-green-700/30 bg-green-700/5 p-5 text-center">

              <p className="text-sm font-semibold text-green-800">
                ✓ {success}
              </p>

            </div>

          )}


          {/* ==================================================
              SCANNER
          ================================================== */}

          {scannerOpen && (

            <div className="mt-10 overflow-hidden border border-[#b9d7ea] bg-white shadow-sm">

              <div className="flex items-center justify-between border-b border-[#b9d7ea]/40 px-5 py-5">

                <div>

                  <p className="text-sm font-semibold tracking-[0.15em]">
                    SCAN QR CODE
                  </p>

                  <p className="mt-1 text-xs text-[#0b1f3a]/50">
                    Point the camera at the guest&apos;s invitation.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    void stopScanner()
                  }
                  className="text-xs font-semibold tracking-wide text-[#7a263a] hover:underline"
                >
                  CLOSE
                </button>

              </div>


              {/* CAMERA */}

              <div className="relative bg-black">

                <div
                  id="qr-reader"
                  className="min-h-[320px] w-full overflow-hidden sm:min-h-[420px]"
                />

                {scannerLoading && (

                  <div className="absolute inset-0 flex items-center justify-center bg-black">

                    <div className="text-center text-white">

                      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                      <p className="mt-5 text-sm">
                        Starting camera...
                      </p>

                      <p className="mt-2 text-xs text-white/50">
                        Please allow camera access.
                      </p>

                    </div>

                  </div>

                )}

              </div>


              {scannerError && (

                <div className="border-t border-[#7a263a]/20 bg-[#7a263a]/5 px-5 py-4 text-center">

                  <p className="text-sm text-[#7a263a]">
                    {scannerError}
                  </p>

                </div>

              )}


              <div className="px-5 py-5 text-center">

                <p className="text-xs leading-5 text-[#0b1f3a]/50">
                  Hold the guest&apos;s QR code
                  inside the scanning area.
                </p>

              </div>

            </div>

          )}


          {/* ==================================================
              CHECK-IN OPTIONS
          ================================================== */}

          {!scannerOpen &&
            !ticket && (

              <div className="mt-10">

                {/* =================================================
                    QR BUTTON
                ================================================= */}

                <button
                  type="button"
                  onClick={() =>
                    void startScanner()
                  }
                  className="w-full bg-[#0b1f3a] px-6 py-8 text-center text-white transition hover:bg-[#7a263a]"
                >

                  <div className="text-5xl leading-none">
                    ◫
                  </div>

                  <p className="mt-4 text-sm font-semibold tracking-[0.2em]">
                    SCAN QR CODE
                  </p>

                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-white/60">
                    Scan the QR code on the
                    guest&apos;s digital invitation.
                  </p>

                </button>


                {/* =================================================
                    DIVIDER
                ================================================= */}

                <div className="my-8 flex items-center gap-4">

                  <div className="h-px flex-1 bg-[#b9d7ea]" />

                  <span className="text-xs font-medium tracking-[0.2em] text-[#0b1f3a]/40">
                    OR
                  </span>

                  <div className="h-px flex-1 bg-[#b9d7ea]" />

                </div>


                {/* =================================================
                    SIX DIGIT TICKET
                ================================================= */}

                <div className="border border-[#b9d7ea] bg-white p-7 shadow-sm sm:p-9">

                  <div className="text-center">

                    <p className="text-sm font-semibold tracking-[0.2em]">
                      ENTER TICKET NUMBER
                    </p>

                    <p className="mt-2 text-xs text-[#0b1f3a]/50">
                      Enter the 6-digit number
                      shown on the invitation.
                    </p>

                  </div>


                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={6}
                    value={ticketNumber}
                    onChange={(event) => {

                      const value =
                        event.target.value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(0, 6);

                      setTicketNumber(
                        value
                      );

                      setError("");
                      setSuccess("");

                    }}
                    onKeyDown={(event) => {

                      if (
                        event.key ===
                        "Enter"
                      ) {
                        void verifyTicketNumber();
                      }

                    }}
                    placeholder="000000"
                    className="mt-7 w-full border border-[#b9d7ea] bg-[#fdfdfc] px-4 py-5 text-center font-mono text-3xl tracking-[0.3em] outline-none transition focus:border-[#7a263a]"
                  />


                  <button
                    type="button"
                    disabled={
                      loading ||
                      ticketNumber.length !==
                        6
                    }
                    onClick={() =>
                      void verifyTicketNumber()
                    }
                    className="mt-5 w-full bg-[#7a263a] px-6 py-4 text-sm font-semibold tracking-[0.2em] text-white transition hover:bg-[#0b1f3a] disabled:cursor-not-allowed disabled:opacity-40"
                  >

                    {loading
                      ? "VERIFYING..."
                      : "VERIFY TICKET"}

                  </button>

                </div>

              </div>

            )}


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading &&
            !scannerOpen &&
            !ticket && (

              <div className="mt-8 flex justify-center">

                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b9d7ea] border-t-[#7a263a]" />

              </div>

            )}


          {/* ==================================================
              VERIFIED TICKET
          ================================================== */}

          {ticket && (

            <div className="mt-10 overflow-hidden border border-[#b9d7ea] bg-white shadow-xl">

              {/* =================================================
                  VERIFIED HEADER
              ================================================= */}

              <div className="bg-[#0b1f3a] px-6 py-9 text-center text-white">

                <p className="text-xs font-semibold tracking-[0.3em] text-[#b9d7ea]">
                  INVITATION VERIFIED
                </p>

                <h2 className="mt-3 text-3xl font-light">
                  {guestName}
                </h2>

              </div>


              <div className="p-6 sm:p-8">

                {/* =================================================
                    TICKET NUMBER
                ================================================= */}

                {ticket.ticket_number && (

                  <div className="border border-[#b9d7ea] bg-[#f7faff] px-5 py-6 text-center">

                    <p className="text-[10px] font-semibold tracking-[0.25em] text-[#0b1f3a]/50">
                      TICKET NUMBER
                    </p>

                    <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.25em] text-[#7a263a]">
                      {ticket.ticket_number}
                    </p>

                  </div>

                )}


                {/* =================================================
                    GUEST
                ================================================= */}

                <div className="mt-7 border-b border-[#b9d7ea]/40 pb-6">

                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[#0b1f3a]/40">
                    GUEST
                  </p>

                  <p className="mt-2 text-2xl font-light">
                    {guestName}
                  </p>

                  {ticket.guest?.email && (

                    <p className="mt-1 text-sm text-[#0b1f3a]/50">
                      {ticket.guest.email}
                    </p>

                  )}

                  {ticket.guest?.phone && (

                    <p className="mt-1 text-sm text-[#0b1f3a]/50">
                      {ticket.guest.phone}
                    </p>

                  )}

                </div>


                {/* =================================================
                    RSVP DETAILS
                ================================================= */}

                <div className="mt-7 grid gap-6 sm:grid-cols-2">

                  <div>

                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0b1f3a]/40">
                      RSVP
                    </p>

                    <p className="mt-1 text-sm font-semibold">

                      {ticket.rsvp
                        ? ticket.rsvp.attending
                          ? "ATTENDING"
                          : "DECLINED"
                        : "NO RSVP"}

                    </p>

                  </div>


                  <div>

                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0b1f3a]/40">
                      GUEST COUNT
                    </p>

                    <p className="mt-1 text-lg">
                      {ticket.rsvp
                        ?.guest_count ??
                        1}
                    </p>

                  </div>


                  {ticket.rsvp
                    ?.meal_preference && (

                    <div>

                      <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0b1f3a]/40">
                        MEAL
                      </p>

                      <p className="mt-1 text-sm capitalize">
                        {
                          ticket.rsvp
                            .meal_preference
                        }
                      </p>

                    </div>

                  )}

                </div>


                {/* =================================================
                    ADDITIONAL GUESTS
                ================================================= */}

                {ticket.rsvp
                  ?.additional_guest_names && (

                  <div className="mt-7 border-t border-[#b9d7ea]/40 pt-6">

                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0b1f3a]/40">
                      ADDITIONAL GUESTS
                    </p>

                    <p className="mt-2 text-sm leading-6">
                      {
                        ticket.rsvp
                          .additional_guest_names
                      }
                    </p>

                  </div>

                )}


                {/* =================================================
                    DIETARY REQUIREMENTS
                ================================================= */}

                {ticket.rsvp
                  ?.dietary_requirements && (

                  <div className="mt-7 border-t border-[#b9d7ea]/40 pt-6">

                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0b1f3a]/40">
                      DIETARY REQUIREMENTS
                    </p>

                    <p className="mt-2 text-sm leading-6">
                      {
                        ticket.rsvp
                          .dietary_requirements
                      }
                    </p>

                  </div>

                )}


                {/* =================================================
                    CHECK-IN STATUS
                ================================================= */}

                <div className="mt-8">

                  {ticket.checked_in ? (

                    <div className="border border-[#7a263a]/25 bg-[#7a263a]/5 p-6 text-center">

                      <div className="text-3xl">
                        ✓
                      </div>

                      <p className="mt-3 text-sm font-semibold tracking-[0.1em] text-[#7a263a]">
                        ALREADY CHECKED IN
                      </p>

                      <p className="mt-2 text-xs text-[#0b1f3a]/50">
                        This ticket has already
                        been used for entry.
                      </p>

                    </div>

                  ) : ticket.rsvp &&
                    ticket.rsvp.attending ===
                      false ? (

                    <div className="border border-[#7a263a]/25 bg-[#7a263a]/5 p-6 text-center">

                      <p className="text-sm font-semibold text-[#7a263a]">
                        RSVP DECLINED
                      </p>

                      <p className="mt-2 text-xs text-[#0b1f3a]/50">
                        This guest did not confirm
                        attendance.
                      </p>

                    </div>

                  ) : (

                    <button
                      type="button"
                      disabled={checkingIn}
                      onClick={() =>
                        void handleCheckIn()
                      }
                      className="w-full bg-[#7a263a] px-6 py-5 text-sm font-semibold tracking-[0.2em] text-white transition hover:bg-[#0b1f3a] disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      {checkingIn
                        ? "CHECKING IN..."
                        : "✓ CHECK IN GUEST"}

                    </button>

                  )}

                </div>


                {/* =================================================
                    CHECK ANOTHER
                ================================================= */}

                <button
                  type="button"
                  onClick={resetCheckIn}
                  className="mt-4 w-full border border-[#0b1f3a]/20 px-6 py-4 text-xs font-semibold tracking-[0.15em] text-[#0b1f3a] transition hover:border-[#7a263a] hover:text-[#7a263a]"
                >
                  CHECK IN ANOTHER GUEST
                </button>

              </div>

            </div>

          )}

        </div>

      </section>


      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="border-t border-[#b9d7ea]/40 bg-white px-6 py-8 text-center">

        <p className="text-sm tracking-[0.2em]">
          M &amp; O
        </p>

        <p className="mt-2 text-xs text-[#0b1f3a]/45">
          Osebosola Memorial Hall · Ondo State, Nigeria
        </p>

      </footer>

    </main>
  );
}