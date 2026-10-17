"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";

type TicketRow = {
  id: string;
  rsvp_guest_id: string;
  ticket_number: string | null;
  qr_token: string;
  checked_in: boolean;
  checked_in_at: string | null;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

type RSVP = {
  id: string;
  guest_id: string;
  attending: boolean;
  guest_count: number;
  additional_guest_names: string | null;
  meal_preference: string | null;
  dietary_requirements: string | null;
  message: string | null;
};

type RSVPGuest = {
  id: string;
  rsvp_id: string;
  name: string;
  guest_type: string;
  table_number: string | null;
};

type PartyMember = RSVPGuest & {
  ticket: TicketRow | null;
};

type PhysicalGuestGroup = {
  id: string;
  group_name: string;
  expected_count: number;
  arrived_count: number;
  created_at: string;
  updated_at: string;
};

type TicketInfo = {
  id: string;
  rsvp_guest_id: string;
  ticket_number: string | null;
  qr_token: string;
  checked_in: boolean;
  checked_in_at: string | null;

  rsvpGuest: RSVPGuest | null;
  guest: Guest | null;
  rsvp: RSVP | null;

  partyMembers: PartyMember[];
};

export default function CheckInPage() {
  const supabase = createClient();

  // ============================================================
  // STATE
  // ============================================================

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [scannerLoading, setScannerLoading] =
    useState(false);

  const [scannerError, setScannerError] =
    useState("");

  const [ticketNumber, setTicketNumber] =
    useState("");

  const [guestSearch, setGuestSearch] =
    useState("");

  const [guestSearchResults, setGuestSearchResults] =
    useState<RSVPGuest[]>([]);

  const [guestSearchLoading, setGuestSearchLoading] =
    useState(false);

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

  // Physical invitation group check-in
  const [physicalGroups, setPhysicalGroups] =
    useState<PhysicalGuestGroup[]>([]);
  const [groupSearch, setGroupSearch] =
    useState("");
  const [groupAdditionalArrivals, setGroupAdditionalArrivals] =
    useState<Record<string, string>>({});
  const [groupsLoading, setGroupsLoading] =
    useState(false);
  const [groupSaving, setGroupSaving] =
    useState(false);

  // ============================================================
  // PHYSICAL INVITATION GROUPS
  // ============================================================

  async function loadPhysicalGroups() {
    setGroupsLoading(true);
    try {
      const { data, error: groupsError } = await supabase
        .from("physical_guest_groups")
        .select("id, group_name, expected_count, arrived_count, created_at, updated_at")
        .order("group_name", { ascending: true });

      if (groupsError) throw groupsError;
      setPhysicalGroups((data || []) as PhysicalGuestGroup[]);
    } catch (err: any) {
      console.error("Could not load physical invitation groups:", err);
      setError(err?.message || "Could not load physical invitation groups.");
    } finally {
      setGroupsLoading(false);
    }
  }

  async function recordGroupArrivals(group: PhysicalGuestGroup) {
    const additional = Number(groupAdditionalArrivals[group.id] || "");
    const remaining = group.expected_count - group.arrived_count;

    if (!Number.isInteger(additional) || additional < 1) {
      setError("Enter the number of additional people who have just arrived.");
      return;
    }
    if (additional > remaining) {
      setError(`Only ${remaining} more ${remaining === 1 ? "person can" : "people can"} be recorded for ${group.group_name}.`);
      return;
    }

    setGroupSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "add_physical_group_arrivals",
        { p_group_id: group.id, p_additional: additional }
      );
      if (rpcError) throw rpcError;

      const updated = Array.isArray(data) ? data[0] : data;
      if (!updated) throw new Error("No updated group record was returned. Refresh and try again.");

      setPhysicalGroups((current) => current.map((item) =>
        item.id === group.id ? updated as PhysicalGuestGroup : item
      ));
      setGroupAdditionalArrivals((current) => ({ ...current, [group.id]: "" }));
      setSuccess(`Recorded ${additional} ${additional === 1 ? "arrival" : "arrivals"} for ${group.group_name}.`);
    } catch (err: any) {
      console.error("Could not record group arrivals:", err);
      setError(err?.message || "Could not record arrivals. Refresh the group list and try again.");
      await loadPhysicalGroups();
    } finally {
      setGroupSaving(false);
    }
  }

  useEffect(() => {
    void loadPhysicalGroups();
    // Load the group list when the check-in page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // BUILD COMPLETE TICKET INFORMATION
  //
  // tickets
  //    ↓
  // rsvp_guests
  //    ↓
  // rsvps
  //    ↓
  // guests
  //
  // Also loads every member of the RSVP party and their ticket.
  // ============================================================

  async function buildTicketInfo(
    ticketData: TicketRow
  ): Promise<TicketInfo | null> {
    // ----------------------------------------------------------
    // 1. FIND THE INDIVIDUAL RSVP GUEST
    // ----------------------------------------------------------

    const {
      data: rsvpGuestData,
      error: rsvpGuestError,
    } = await supabase
      .from("rsvp_guests")
      .select(
        `
        id,
        rsvp_id,
        name,
        guest_type,
        table_number
        `
      )
      .eq(
        "id",
        ticketData.rsvp_guest_id
      )
      .maybeSingle();

    console.log(
      "RSVP guest search:",
      {
        rsvpGuestData,
        rsvpGuestError,
      }
    );

    if (rsvpGuestError) {
      throw rsvpGuestError;
    }

    if (!rsvpGuestData) {
      setError(
        "This ticket exists, but it is not connected to a guest."
      );

      return null;
    }

    const rsvpGuest =
      rsvpGuestData as RSVPGuest;

    // ----------------------------------------------------------
    // 2. FIND RSVP
    // ----------------------------------------------------------

    const {
      data: rsvpData,
      error: rsvpError,
    } = await supabase
      .from("rsvps")
      .select(
        `
        id,
        guest_id,
        attending,
        guest_count,
        additional_guest_names,
        meal_preference,
        dietary_requirements,
        message
        `
      )
      .eq(
        "id",
        rsvpGuest.rsvp_id
      )
      .maybeSingle();

    console.log(
      "RSVP search:",
      {
        rsvpData,
        rsvpError,
      }
    );

    if (rsvpError) {
      throw rsvpError;
    }

    const rsvp =
      rsvpData as RSVP | null;

    // ----------------------------------------------------------
    // 3. FIND PRIMARY RSVP CONTACT
    //
    // The individual ticket belongs to rsvp_guests.
    // The RSVP itself points to the primary contact in guests.
    // ----------------------------------------------------------

    let guest: Guest | null = null;

    if (rsvp?.guest_id) {
      const {
        data: guestData,
        error: guestError,
      } = await supabase
        .from("guests")
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          phone
          `
        )
        .eq(
          "id",
          rsvp.guest_id
        )
        .maybeSingle();

      console.log(
        "Primary guest search:",
        {
          guestData,
          guestError,
        }
      );

      if (guestError) {
        throw guestError;
      }

      guest =
        (guestData as Guest | null) ||
        null;
    }

    // ----------------------------------------------------------
    // 4. FIND EVERY MEMBER OF THIS RSVP PARTY
    // ----------------------------------------------------------

    let partyGuests: RSVPGuest[] = [];

    if (rsvp?.id) {
      const {
        data: partyGuestData,
        error: partyGuestError,
      } = await supabase
        .from("rsvp_guests")
        .select(
          `
          id,
          rsvp_id,
          name,
          guest_type,
          table_number
          `
        )
        .eq(
          "rsvp_id",
          rsvp.id
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      console.log(
        "Party guests:",
        {
          partyGuestData,
          partyGuestError,
        }
      );

      if (partyGuestError) {
        throw partyGuestError;
      }

      partyGuests =
        (partyGuestData || []) as RSVPGuest[];
    }

    // ----------------------------------------------------------
    // 5. FIND TICKETS FOR EVERY MEMBER OF THE PARTY
    // ----------------------------------------------------------

    const partyMemberIds =
      partyGuests.map(
        (partyGuest) =>
          partyGuest.id
      );

    let partyTickets: TicketRow[] =
      [];

    if (
      partyMemberIds.length > 0
    ) {
      const {
        data: partyTicketData,
        error: partyTicketError,
      } = await supabase
        .from("tickets")
        .select(
          `
          id,
          rsvp_guest_id,
          ticket_number,
          qr_token,
          checked_in,
          checked_in_at
          `
        )
        .in(
          "rsvp_guest_id",
          partyMemberIds
        );

      console.log(
        "Party tickets:",
        {
          partyTicketData,
          partyTicketError,
        }
      );

      if (partyTicketError) {
        throw partyTicketError;
      }

      partyTickets =
        (partyTicketData || []) as TicketRow[];
    }

    // ----------------------------------------------------------
    // 6. COMBINE PARTY PEOPLE WITH THEIR TICKETS
    // ----------------------------------------------------------

    const partyMembers: PartyMember[] =
      partyGuests.map(
        (partyGuest) => ({
          ...partyGuest,

          ticket:
            partyTickets.find(
              (partyTicket) =>
                partyTicket.rsvp_guest_id ===
                partyGuest.id
            ) || null,
        })
      );

    // ----------------------------------------------------------
    // 7. RETURN COMPLETE INFORMATION
    // ----------------------------------------------------------

    return {
      id: ticketData.id,

      rsvp_guest_id:
        ticketData.rsvp_guest_id,

      ticket_number:
        ticketData.ticket_number,

      qr_token:
        ticketData.qr_token,

      checked_in:
        ticketData.checked_in,

      checked_in_at:
        ticketData.checked_in_at,

      rsvpGuest,

      guest,

      rsvp,

      partyMembers,
    };
  }

  // ============================================================
  // FIND GUEST BY NAME
  // ============================================================

  async function searchGuestsByName() {
    const query = guestSearch.trim();

    setError("");
    setSuccess("");
    setTicket(null);

    if (query.length < 2) {
      setGuestSearchResults([]);
      setError("Please enter at least 2 characters of the guest's name.");
      return;
    }

    setGuestSearchLoading(true);

    try {
      const {
        data,
        error: searchError,
      } = await supabase
        .from("rsvp_guests")
        .select(
          `
          id,
          rsvp_id,
          name,
          guest_type,
          table_number
          `
        )
        .ilike("name", `%${query}%`)
        .order("name", {
          ascending: true,
        })
        .limit(20);

      console.log(
        "Guest name search:",
        {
          query,
          data,
          searchError,
        }
      );

      if (searchError) {
        throw searchError;
      }

      setGuestSearchResults(
        (data || []) as RSVPGuest[]
      );

      if (!data || data.length === 0) {
        setError(
          `No guest was found matching "${query}".`
        );
      }
    } catch (err: any) {
      console.error(
        "Guest name search error:",
        {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          error: err,
        }
      );

      setGuestSearchResults([]);

      setError(
        err?.message ||
          "We could not search for this guest."
      );
    } finally {
      setGuestSearchLoading(false);
    }
  }

  async function loadGuestById(
    rsvpGuest: RSVPGuest
  ) {
    setLoading(true);
    setError("");
    setSuccess("");
    setTicket(null);

    try {
      const {
        data: ticketData,
        error: ticketError,
      } = await supabase
        .from("tickets")
        .select(
          `
          id,
          rsvp_guest_id,
          ticket_number,
          qr_token,
          checked_in,
          checked_in_at
          `
        )
        .eq(
          "rsvp_guest_id",
          rsvpGuest.id
        )
        .maybeSingle();

      console.log(
        "Ticket found for selected guest:",
        {
          rsvpGuest,
          ticketData,
          ticketError,
        }
      );

      if (ticketError) {
        throw ticketError;
      }

      if (!ticketData) {
        setError(
          `No ticket was found for ${rsvpGuest.name}.`
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
      setGuestSearchResults([]);
    } catch (err: any) {
      console.error(
        "Selected guest lookup error:",
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
          "We could not load this guest's invitation."
      );
    } finally {
      setLoading(false);
    }
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
      const {
        data: ticketData,
        error: ticketError,
      } = await supabase
        .from("tickets")
        .select(
          `
          id,
          rsvp_guest_id,
          ticket_number,
          qr_token,
          checked_in,
          checked_in_at
          `
        )
        .eq(
          "qr_token",
          token
        )
        .maybeSingle();

      console.log(
        "QR ticket search:",
        {
          token,
          ticketData,
          ticketError,
        }
      );

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

    setError("");
    setSuccess("");
    setTicket(null);

    if (
      !/^\d{6}$/.test(code)
    ) {
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
          rsvp_guest_id,
          ticket_number,
          qr_token,
          checked_in,
          checked_in_at
          `
        )
        .eq(
          "ticket_number",
          code
        )
        .maybeSingle();

      console.log(
        "Ticket number search result:",
        {
          code,
          ticketData,
          ticketError,
        }
      );

      if (ticketError) {
        console.error(
  "Ticket number database error:",
  {
    message:
      ticketError.message,

    details:
      ticketError.details,

    hint:
      ticketError.hint,

    code:
      ticketError.code,
  }
);
        throw ticketError;
      }

      if (!ticketData) {
        setError(
          `No invitation was found with ticket number ${code}.`
        );

        return;
      }

      // --------------------------------------------------------
      // BUILD COMPLETE INDIVIDUAL + PARTY INFORMATION
      // --------------------------------------------------------

      const ticketInfo =
        await buildTicketInfo(
          ticketData as TicketRow
        );

      if (!ticketInfo) {
        return;
      }

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
  // CHECK INDIVIDUAL GUEST IN
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
      // RSVP MUST BE ATTENDING
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

      if (
        ticket.checked_in === true
      ) {
        setError(
          "This guest has already been checked in."
        );

        return;
      }

      // --------------------------------------------------------
      // UPDATE ONLY THIS TICKET
      // --------------------------------------------------------

      const {
        data: updatedTicket,
        error: updateError,
      } = await supabase
        .from("tickets")
        .update({
          checked_in: true,
          checked_in_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          ticket.id
        )
        .eq(
          "checked_in",
          false
        )
        .select(
          `
          id,
          rsvp_guest_id,
          ticket_number,
          qr_token,
          checked_in,
          checked_in_at
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

      if (updateError) {
        throw updateError;
      }

      // --------------------------------------------------------
      // NOTHING UPDATED
      // --------------------------------------------------------

      if (!updatedTicket) {
        const {
          data: currentTicket,
          error: currentError,
        } = await supabase
          .from("tickets")
          .select(
            `
            id,
            rsvp_guest_id,
            ticket_number,
            qr_token,
            checked_in,
            checked_in_at
            `
          )
          .eq(
            "id",
            ticket.id
          )
          .maybeSingle();

        if (currentError) {
          throw currentError;
        }

        if (
          currentTicket?.checked_in ===
          true
        ) {
          setTicket({
            ...ticket,
            checked_in: true,
            checked_in_at:
              currentTicket.checked_in_at,
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

      // --------------------------------------------------------
      // UPDATE CURRENT SCREEN
      // --------------------------------------------------------

      const updated =
        updatedTicket as TicketRow;

      const updatedPartyMembers =
        ticket.partyMembers.map(
          (member) => {
            if (
              member.id !==
              ticket.rsvp_guest_id
            ) {
              return member;
            }

            return {
              ...member,
              ticket: member.ticket
                ? {
                    ...member.ticket,
                    checked_in:
                      true,
                    checked_in_at:
                      updated.checked_in_at,
                  }
                : member.ticket,
            };
          }
        );

      setTicket({
        ...ticket,

        checked_in: true,

        checked_in_at:
          updated.checked_in_at,

        partyMembers:
          updatedPartyMembers,
      });

      setSuccess(
        `${ticket.rsvpGuest?.name || "Guest"} checked in successfully!`
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

    scanLockedRef.current =
      false;

    scannerStartingRef.current =
      true;

    try {
      // --------------------------------------------------------
      // GIVE REACT TIME TO RENDER SCANNER
      // --------------------------------------------------------

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            200
          )
      );

      // --------------------------------------------------------
      // CLEAN UP OLD SCANNER
      // --------------------------------------------------------

      if (
        scannerRef.current
      ) {
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

        scannerRef.current =
          null;

        scannerRunningRef.current =
          false;
      }

      // --------------------------------------------------------
      // CREATE SCANNER
      // --------------------------------------------------------

      const scanner =
        new Html5Qrcode(
          "qr-reader"
        );

      scannerRef.current =
        scanner;

      // --------------------------------------------------------
      // START CAMERA
      // --------------------------------------------------------

      await scanner.start(
        {
          facingMode:
            "environment",
        },

        {
          fps: 10,

          qrbox: {
            width: 250,
            height: 250,
          },

          aspectRatio: 1,
        },

        // ------------------------------------------------------
        // QR DETECTED
        // ------------------------------------------------------

        async (
          decodedText
        ) => {
          console.log(
            "QR code detected:",
            decodedText
          );

          if (
            scanLockedRef.current
          ) {
            return;
          }

          scanLockedRef.current =
            true;

          scannerRunningRef.current =
            false;

          // ----------------------------------------------------
          // STOP CAMERA
          // ----------------------------------------------------

          try {
            await scanner.stop();
          } catch {}

          try {
            scanner.clear();
          } catch {}

          scannerRef.current =
            null;

          setScannerOpen(
            false
          );

          setScannerLoading(
            false
          );

          // ----------------------------------------------------
          // EXTRACT TOKEN
          // ----------------------------------------------------

          let qrToken =
            decodedText.trim();

          try {
            const scannedUrl =
              new URL(
                decodedText
              );

            const urlToken =
              scannedUrl.searchParams.get(
                "token"
              );

            if (urlToken) {
              qrToken =
                urlToken;
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

          // ----------------------------------------------------
          // VERIFY QR TICKET
          // ----------------------------------------------------

          await loadTicketByToken(
            qrToken
          );
        },

        // ------------------------------------------------------
        // SCAN ERRORS
        // ------------------------------------------------------

        (_errorMessage) => {
          // Normal scanner errors are ignored.
        }
      );

      scannerRunningRef.current =
        true;

      setScannerLoading(
        false
      );

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

      setScannerLoading(
        false
      );

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
    if (
      !scannerRef.current
    ) {
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

    scannerRef.current =
      null;

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
    setGuestSearch("");
    setGuestSearchResults([]);

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
      if (
        scannerRef.current
      ) {
        try {
          scannerRef.current.stop();
        } catch {}

        try {
          scannerRef.current.clear();
        } catch {}
      }

      scannerRef.current =
        null;

      scannerRunningRef.current =
        false;

      scannerStartingRef.current =
        false;
    };
  }, []);

  // ============================================================
  // INDIVIDUAL GUEST
  // ============================================================

  const individualName =
    ticket?.rsvpGuest?.name ||
    "";

  // ============================================================
  // INDIVIDUAL GUEST TYPE
  // ============================================================

  const guestType =
    ticket?.rsvpGuest
      ?.guest_type ||
    "";

  // ============================================================
  // INDIVIDUAL TABLE
  // ============================================================

  const individualTable =
    ticket?.rsvpGuest
      ?.table_number
      ?.trim() || "";

  // ============================================================
  // PARTY STATISTICS
  // ============================================================

  const partySize =
    ticket?.partyMembers
      ?.length || 0;

  const partyCheckedIn =
    ticket?.partyMembers
      ?.filter(
        (member) =>
          member.ticket
            ?.checked_in
      ).length || 0;

  const partyRemaining =
    Math.max(
      partySize -
        partyCheckedIn,
      0
    );

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
              Scan the guest&apos;s QR code,
              enter their 6-digit ticket
              number, or find them by name
              to verify their invitation.
            </p>

          </div>


          {/* ==================================================
              PHYSICAL INVITATION GROUP CHECK-IN
          ================================================== */}
          <div className="mt-10 border border-[#b9d7ea] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em]">PHYSICAL INVITATION GROUPS</p>
              <p className="mt-2 text-xs leading-5 text-[#0b1f3a]/55">
                Select a group created by the admin and record arrivals as people arrive. No individual names, QR codes, or ticket numbers are required for these physical invitations.
              </p>
            </div>

            <div className="mt-8 border-t border-[#b9d7ea]/50 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#0b1f3a]/50">GROUP ARRIVAL REGISTER</p>
                <button
                  type="button"
                  onClick={() => void loadPhysicalGroups()}
                  disabled={groupsLoading || groupSaving}
                  className="text-xs font-semibold text-[#7a263a] hover:underline disabled:opacity-50"
                >
                  {groupsLoading ? "REFRESHING..." : "REFRESH GROUPS"}
                </button>
              </div>
              <input
                type="text"
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Search group name"
                className="mt-4 w-full border border-[#b9d7ea] bg-[#fdfdfc] px-4 py-3 text-sm outline-none focus:border-[#7a263a]"
              />

              {groupsLoading && physicalGroups.length === 0 ? (
                <p className="mt-5 text-sm text-[#0b1f3a]/50">Loading groups...</p>
              ) : physicalGroups.filter((group) => group.group_name.toLowerCase().includes(groupSearch.trim().toLowerCase())).length === 0 ? (
                <p className="mt-5 text-sm text-[#0b1f3a]/50">No physical invitation groups have been created yet. Ask the admin to add them.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {physicalGroups
                    .filter((group) => group.group_name.toLowerCase().includes(groupSearch.trim().toLowerCase()))
                    .map((group) => {
                      const remaining = group.expected_count - group.arrived_count;
                      const progress = Math.round((group.arrived_count / group.expected_count) * 100);
                      return (
                        <div key={group.id} className="border border-[#b9d7ea]/70 bg-[#f7faff] p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="break-words text-base font-semibold">{group.group_name}</p>
                              <p className="mt-1 text-xs text-[#0b1f3a]/50">Physical invitation · {group.expected_count} expected</p>
                            </div>
                            <span className={`shrink-0 text-[10px] font-semibold tracking-wide ${remaining === 0 ? "text-green-700" : "text-[#7a263a]"}`}>
                              {remaining === 0 ? "COMPLETE" : "IN PROGRESS"}
                            </span>
                          </div>
                          <div className="mt-5 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#0b1f3a]/45">ARRIVED SO FAR</p>
                              <p className="mt-1 text-3xl font-light">{group.arrived_count}<span className="text-lg text-[#0b1f3a]/40"> / {group.expected_count}</span></p>
                            </div>
                            <p className="text-right text-xs text-[#0b1f3a]/50">{remaining} remaining</p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden bg-[#b9d7ea]/50">
                            <div className="h-full bg-[#7a263a] transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          {remaining > 0 && (
                            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                type="number"
                                min="1"
                                max={remaining}
                                step="1"
                                inputMode="numeric"
                                value={groupAdditionalArrivals[group.id] || ""}
                                onChange={(event) => setGroupAdditionalArrivals((current) => ({ ...current, [group.id]: event.target.value }))}
                                placeholder={`Additional arrivals (max ${remaining})`}
                                aria-label={`Additional arrivals for ${group.group_name}`}
                                className="w-full border border-[#b9d7ea] bg-white px-4 py-3 text-sm outline-none focus:border-[#7a263a]"
                              />
                              <button
                                type="button"
                                disabled={groupSaving || !groupAdditionalArrivals[group.id]}
                                onClick={() => void recordGroupArrivals(group)}
                                className="bg-[#7a263a] px-5 py-3 text-xs font-semibold tracking-[0.12em] text-white hover:bg-[#0b1f3a] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                RECORD ARRIVALS
                              </button>
                            </div>
                          )}
                          <p className="mt-3 text-[10px] text-[#0b1f3a]/40">
                            Last updated: {new Date(group.updated_at).toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
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

                {/* QR BUTTON */}

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


                {/* DIVIDER */}

                <div className="my-8 flex items-center gap-4">

                  <div className="h-px flex-1 bg-[#b9d7ea]" />

                  <span className="text-xs font-medium tracking-[0.2em] text-[#0b1f3a]/40">
                    OR
                  </span>

                  <div className="h-px flex-1 bg-[#b9d7ea]" />

                </div>


                {/* SIX DIGIT TICKET */}

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
                          .slice(
                            0,
                            6
                          );

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

                {/* DIVIDER */}

                <div className="my-8 flex items-center gap-4">

                  <div className="h-px flex-1 bg-[#b9d7ea]" />

                  <span className="text-xs font-medium tracking-[0.2em] text-[#0b1f3a]/40">
                    OR
                  </span>

                  <div className="h-px flex-1 bg-[#b9d7ea]" />

                </div>

                {/* FIND GUEST BY NAME */}

                <div className="border border-[#b9d7ea] bg-white p-7 shadow-sm sm:p-9">

                  <div className="text-center">

                    <p className="text-sm font-semibold tracking-[0.2em]">
                      FIND GUEST BY NAME
                    </p>

                    <p className="mt-2 text-xs leading-5 text-[#0b1f3a]/50">
                      For guests with physical invitations,
                      search for their name to find their
                      individual check-in record.
                    </p>

                  </div>

                  <input
                    type="text"
                    autoComplete="off"
                    value={guestSearch}
                    onChange={(event) => {
                      setGuestSearch(event.target.value);
                      setGuestSearchResults([]);
                      setError("");
                      setSuccess("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void searchGuestsByName();
                      }
                    }}
                    placeholder="Enter guest name"
                    className="mt-7 w-full border border-[#b9d7ea] bg-[#fdfdfc] px-4 py-4 text-center text-lg outline-none transition focus:border-[#7a263a]"
                  />

                  <button
                    type="button"
                    disabled={
                      guestSearchLoading ||
                      guestSearch.trim().length < 2
                    }
                    onClick={() =>
                      void searchGuestsByName()
                    }
                    className="mt-5 w-full bg-[#7a263a] px-6 py-4 text-sm font-semibold tracking-[0.2em] text-white transition hover:bg-[#0b1f3a] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {guestSearchLoading
                      ? "SEARCHING..."
                      : "FIND GUEST"}
                  </button>

                  {guestSearchResults.length > 0 && (

                    <div className="mt-6 border-t border-[#b9d7ea]/50 pt-5">

                      <p className="text-[10px] font-semibold tracking-[0.2em] text-[#0b1f3a]/40">
                        SELECT GUEST
                      </p>

                      <div className="mt-3 space-y-2">

                        {guestSearchResults.map(
                          (result) => (
                            <button
                              key={result.id}
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                void loadGuestById(result)
                              }
                              className="w-full border border-[#b9d7ea]/60 bg-[#f7faff] px-4 py-4 text-left transition hover:border-[#7a263a]/50 hover:bg-[#7a263a]/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                              <div className="flex items-center justify-between gap-4">

                                <div className="min-w-0">

                                  <p className="truncate text-sm font-medium text-[#0b1f3a]">
                                    {result.name}
                                  </p>

                                  <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#0b1f3a]/40">
                                    {result.guest_type}
                                  </p>

                                </div>

                                <div className="shrink-0 text-right">

                                  {result.table_number ? (
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a263a]">
                                      Table {result.table_number}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-[#0b1f3a]/35">
                                      Table not assigned
                                    </p>
                                  )}

                                  <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#0b1f3a]/35">
                                    Select
                                  </p>

                                </div>

                              </div>

                            </button>
                          )
                        )}

                      </div>

                    </div>

                  )}

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

              {/* VERIFIED HEADER */}

              <div className="bg-[#0b1f3a] px-6 py-9 text-center text-white">

                <p className="text-xs font-semibold tracking-[0.3em] text-[#b9d7ea]">
                  INVITATION VERIFIED
                </p>

                <h2 className="mt-3 text-3xl font-light">
                  {individualName}
                </h2>

                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  {guestType}
                </p>

              </div>


              <div className="p-6 sm:p-8">

                {/* =================================================
                    TICKET NUMBER
                ================================================= */}

                {ticket.ticket_number && (

                  <div className="border border-[#b9d7ea] bg-[#f7faff] px-5 py-6 text-center">

                    <p className="text-[10px] font-semibold tracking-[0.25em] text-[#0b1f3a]/50">
                      INDIVIDUAL TICKET NUMBER
                    </p>

                    <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.25em] text-[#7a263a]">
                      {ticket.ticket_number}
                    </p>

                  </div>

                )}


                {/* =================================================
                    TABLE NUMBER
                ================================================= */}

                {individualTable && (

                  <div className="mt-7 border-2 border-[#7a263a] bg-[#7a263a]/5 px-5 py-7 text-center">

                    <p className="text-[10px] font-semibold tracking-[0.3em] text-[#7a263a]">
                      TABLE ASSIGNMENT
                    </p>

                    <p className="mt-3 text-sm text-[#0b1f3a]/60">
                      Please proceed to
                    </p>

                    <p className="mt-1 font-serif text-5xl font-semibold text-[#7a263a]">
                      TABLE{" "}
                      {individualTable}
                    </p>

                  </div>

                )}


                {/* =================================================
                    INDIVIDUAL GUEST
                ================================================= */}

                <div className="mt-7 border-b border-[#b9d7ea]/40 pb-6">

                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[#0b1f3a]/40">
                    GUEST
                  </p>

                  <p className="mt-2 text-2xl font-light">
                    {individualName}
                  </p>

                  <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[#7a263a]">
                    {guestType}
                  </p>

                  {guestType
                    .toLowerCase()
                    .includes("primary") &&
                    ticket.guest?.email && (

                      <p className="mt-3 text-sm text-[#0b1f3a]/50">
                        {ticket.guest.email}
                      </p>

                    )}

                  {guestType
                    .toLowerCase()
                    .includes("primary") &&
                    ticket.guest?.phone && (

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
                      PARTY SIZE
                    </p>

                    <p className="mt-1 text-lg">
                      {partySize}
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
                    PARTY CHECK-IN PROGRESS
                ================================================= */}

                {partySize > 0 && (

                  <div className="mt-8 border border-[#b9d7ea] bg-[#f7faff] p-6">

                    <div className="flex items-end justify-between gap-4">

                      <div>

                        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#0b1f3a]/40">
                          PARTY CHECK-IN
                        </p>

                        <p className="mt-2 text-3xl font-light">
                          {partyCheckedIn}
                          <span className="text-lg text-[#0b1f3a]/40">
                            {" "}
                            / {partySize}
                          </span>
                        </p>

                      </div>

                      <p className="text-right text-xs text-[#0b1f3a]/50">
                        {partyRemaining === 0
                          ? "Everyone has arrived"
                          : `${partyRemaining} ${
                              partyRemaining ===
                              1
                                ? "guest"
                                : "guests"
                            } remaining`}

                      </p>

                    </div>


                    <div className="mt-5 h-2 overflow-hidden bg-[#b9d7ea]/40">

                      <div
                        className="h-full bg-[#7a263a] transition-all duration-500"
                        style={{
                          width: `${
                            partySize > 0
                              ? Math.round(
                                  (partyCheckedIn /
                                    partySize) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />

                    </div>

                  </div>

                )}


                {/* =================================================
                    PARTY GUESTS
                ================================================= */}

                {ticket.partyMembers.length >
                  0 && (

                  <div className="mt-8 border-t border-[#b9d7ea]/40 pt-6">

                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0b1f3a]/40">
                      PARTY GUESTS
                    </p>

                    <div className="mt-4 space-y-3">

                      {ticket.partyMembers.map(
                        (member) => {

                          const isCurrentGuest =
                            member.id ===
                            ticket.rsvp_guest_id;

                          const memberCheckedIn =
                            member.ticket
                              ?.checked_in ===
                            true;

                          return (

                            <div
                              key={
                                member.id
                              }
                              className={`flex items-center justify-between gap-4 border px-4 py-4 ${
                                isCurrentGuest
                                  ? "border-[#7a263a]/40 bg-[#7a263a]/5"
                                  : "border-[#b9d7ea]/40 bg-[#f7faff]"
                              }`}
                            >

                              <div className="min-w-0">

                                <div className="flex flex-wrap items-center gap-2">

                                  <p className="truncate text-sm font-medium">
                                    {
                                      member.name
                                    }
                                  </p>

                                  {isCurrentGuest && (

                                    <span className="text-[9px] font-semibold tracking-[0.1em] text-[#7a263a]">
                                      THIS GUEST
                                    </span>

                                  )}

                                </div>

                                <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#0b1f3a]/40">
                                  {
                                    member.guest_type
                                  }
                                </p>

                              </div>


                              <div className="shrink-0 text-right">

                                {memberCheckedIn ? (

                                  <p className="text-xs font-semibold text-green-700">
                                    ✓ CHECKED IN
                                  </p>

                                ) : (

                                  <p className="text-xs text-[#0b1f3a]/40">
                                    NOT CHECKED IN
                                  </p>

                                )}

                                {member.table_number && (

                                  <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#7a263a]">
                                    Table{" "}
                                    {
                                      member.table_number
                                    }
                                  </p>

                                )}

                              </div>

                            </div>

                          );

                        }
                      )}

                    </div>

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

                    <div className="border border-green-700/25 bg-green-700/5 p-6 text-center">

                      <div className="text-3xl text-green-700">
                        ✓
                      </div>

                      <p className="mt-3 text-sm font-semibold tracking-[0.1em] text-green-800">
                        ALREADY CHECKED IN
                      </p>

                      <p className="mt-2 text-xs text-[#0b1f3a]/50">
                        This individual ticket has
                        already been used for entry.
                      </p>

                      {ticket.checked_in_at && (

                        <p className="mt-2 text-[10px] text-[#0b1f3a]/40">
                          Checked in{" "}
                          {new Date(
                            ticket.checked_in_at
                          ).toLocaleString()}
                        </p>

                      )}

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
                      disabled={
                        checkingIn
                      }
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
                  onClick={
                    resetCheckIn
                  }
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