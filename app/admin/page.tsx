"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// TYPES
// ============================================================

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string;
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

type Ticket = {
  id: string;
  rsvp_guest_id: string;
  guest_id?: string | null;
  qr_token: string;
  ticket_number: string | null;
  checked_in: boolean;
};

type RSVPGuest = {
  id: string;
  rsvp_id: string;
  name: string;
  guest_type: string;
  table_number: string | null;
  created_at?: string;
};

type GuestRow = {
  rsvpGuest: RSVPGuest;
  primaryGuest?: Guest;
  rsvp?: RSVP;
  ticket?: Ticket;
  isPrimary: boolean;
};

type PartyMember = {
  rsvpGuest: RSVPGuest;
  ticket?: Ticket;
  isPrimary: boolean;
};

// ============================================================
// PAGE
// ============================================================

export default function AdminPage() {
  const supabase = createClient();

  // ==========================================================
  // AUTH
  // ==========================================================

  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ==========================================================
  // LOGIN
  // ==========================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // ==========================================================
  // DATA
  // ==========================================================

  const [guests, setGuests] = useState<Guest[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [rsvpGuests, setRsvpGuests] = useState<RSVPGuest[]>([]);

  // ==========================================================
  // UI
  // ==========================================================

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(
    null
  );
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(
    null
  );

  // ==========================================================
  // CHECK AUTH
  // ==========================================================

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setCheckingAuth(false);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCheckingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // ==========================================================
  // LOAD DATA AFTER LOGIN
  // ==========================================================

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadData();
  }, [session]);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadData() {
    setLoadingData(true);
    setDataError("");

    try {
      // --------------------------------------------------------
      // GUESTS
      // --------------------------------------------------------

      const guestsResult = await supabase
        .from("guests")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (guestsResult.error) {
        throw new Error(
          `Guests: ${guestsResult.error.message}`
        );
      }

      // --------------------------------------------------------
      // RSVPS
      // --------------------------------------------------------

      const rsvpsResult = await supabase
        .from("rsvps")
        .select("*");

      if (rsvpsResult.error) {
        throw new Error(
          `RSVPs: ${rsvpsResult.error.message}`
        );
      }

      // --------------------------------------------------------
      // TICKETS
      // --------------------------------------------------------

      const ticketsResult = await supabase
        .from("tickets")
        .select("*");

      if (ticketsResult.error) {
        throw new Error(
          `Tickets: ${ticketsResult.error.message}`
        );
      }

      // --------------------------------------------------------
      // RSVP GUESTS
      // --------------------------------------------------------

      const rsvpGuestsResult = await supabase
        .from("rsvp_guests")
        .select("*")
        .order("created_at", {
          ascending: true,
        });

      if (rsvpGuestsResult.error) {
        throw new Error(
          `RSVP guests: ${rsvpGuestsResult.error.message}`
        );
      }

      // --------------------------------------------------------
      // SAVE DATA
      // --------------------------------------------------------

      setGuests((guestsResult.data || []) as Guest[]);
      setRsvps((rsvpsResult.data || []) as RSVP[]);
      setTickets((ticketsResult.data || []) as Ticket[]);
      setRsvpGuests((rsvpGuestsResult.data || []) as RSVPGuest[]);
    } catch (error: any) {
      console.error("ADMIN DATA ERROR");
      console.error("Message:", error?.message);
      console.error("Details:", error?.details);
      console.error("Hint:", error?.hint);
      console.error("Code:", error?.code);
      console.error(
        "Full error:",
        JSON.stringify(
          error,
          Object.getOwnPropertyNames(error),
          2
        )
      );

      setDataError(
        error?.message ||
          error?.details ||
          "Unable to load wedding data."
      );
    } finally {
      setLoadingData(false);
    }
  }

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoginLoading(true);
    setLoginError("");

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setLoginError(
        error.message || "Unable to sign in."
      );
    }

    setLoginLoading(false);
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    setGuests([]);
    setRsvps([]);
    setTickets([]);
    setRsvpGuests([]);
    setSelectedGuest(null);
  }

  // ==========================================================
  // CHECK-IN / UNDO CHECK-IN
  // ==========================================================

  async function toggleCheckIn(ticket: Ticket) {
    const newStatus = !ticket.checked_in;

    setUpdatingTicketId(ticket.id);

    const { error } = await supabase
      .from("tickets")
      .update({
        checked_in: newStatus,
      })
      .eq("id", ticket.id);

    if (error) {
      alert(
        error.message ||
          "Unable to update check-in status."
      );

      setUpdatingTicketId(null);
      return;
    }

    // Update tickets in state.
    setTickets((current) =>
      current.map((item) =>
        item.id === ticket.id
          ? {
              ...item,
              checked_in: newStatus,
            }
          : item
      )
    );

    // Update selected guest modal if this ticket
    // belongs to the currently selected guest.
    setSelectedGuest((current) => {
      if (
        !current ||
        !current.ticket ||
        current.ticket.id !== ticket.id
      ) {
        return current;
      }

      return {
        ...current,
        ticket: {
          ...current.ticket,
          checked_in: newStatus,
        },
      };
    });

    setUpdatingTicketId(null);
  }

  // ==========================================================
  // BUILD COMPLETE INDIVIDUAL GUEST LIST
  // ==========================================================

  const guestRows = useMemo<GuestRow[]>(() => {
    return rsvpGuests.map((rsvpGuest) => {
      const rsvp = rsvps.find(
        (item) => item.id === rsvpGuest.rsvp_id
      );

      const primaryGuest = rsvp
        ? guests.find(
            (guest) => guest.id === rsvp.guest_id
          )
        : undefined;

      // IMPORTANT:
      // Each individual RSVP guest now gets their own
      // ticket through tickets.rsvp_guest_id.
      const ticket = tickets.find(
        (item) =>
          item.rsvp_guest_id === rsvpGuest.id
      );

      const isPrimary =
        rsvpGuest.guest_type?.toLowerCase() ===
        "primary";

      return {
        rsvpGuest,
        primaryGuest,
        rsvp,
        ticket,
        isPrimary,
      };
    });
  }, [
    rsvpGuests,
    rsvps,
    guests,
    tickets,
  ]);

  // ==========================================================
  // SEARCH
  // ==========================================================

  const filteredGuests = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) {
      return guestRows;
    }

    return guestRows.filter((row) => {
      const individualName =
        row.rsvpGuest.name?.toLowerCase() || "";

      const primaryName = row.primaryGuest
        ? `${row.primaryGuest.first_name} ${row.primaryGuest.last_name}`.toLowerCase()
        : "";

      const email =
        row.primaryGuest?.email?.toLowerCase() ||
        "";

      const phone =
        row.primaryGuest?.phone?.toLowerCase() ||
        "";

      const table =
        row.rsvpGuest.table_number?.toLowerCase() ||
        "";

      const ticketNumber =
        row.ticket?.ticket_number?.toLowerCase() ||
        "";

      return (
        individualName.includes(query) ||
        primaryName.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        table.includes(query) ||
        ticketNumber.includes(query)
      );
    });
  }, [guestRows, search]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const totalRSVPs = rsvps.length;

  const attending = rsvps.filter(
    (rsvp) => rsvp.attending
  ).length;

  const declined = rsvps.filter(
    (rsvp) => !rsvp.attending
  ).length;

  const attendingRsvpIds = new Set(
    rsvps
      .filter((rsvp) => rsvp.attending)
      .map((rsvp) => rsvp.id)
  );

  const attendingGuests = rsvpGuests.filter(
    (guest) => attendingRsvpIds.has(guest.rsvp_id)
  );

  const totalGuests = attendingGuests.length;

  const checkedIn = tickets.filter(
    (ticket) => ticket.checked_in
  ).length;

  const attendingGuestIds = new Set(
    attendingGuests.map((guest) => guest.id)
  );

  const attendingTickets = tickets.filter(
    (ticket) =>
      attendingGuestIds.has(ticket.rsvp_guest_id)
  );

  const notCheckedIn = attendingTickets.filter(
    (ticket) => !ticket.checked_in
  ).length;

  // ==========================================================
  // SELECTED GUEST PARTY
  // ==========================================================

  const selectedParty = useMemo<PartyMember[]>(() => {
    if (!selectedGuest) {
      return [];
    }

    return rsvpGuests
      .filter(
        (guest) =>
          guest.rsvp_id ===
          selectedGuest.rsvpGuest.rsvp_id
      )
      .map((guest) => ({
        rsvpGuest: guest,
        ticket: tickets.find(
          (ticket) =>
            ticket.rsvp_guest_id === guest.id
        ),
        isPrimary:
          guest.guest_type?.toLowerCase() ===
          "primary",
      }));
  }, [
    selectedGuest,
    rsvpGuests,
    tickets,
  ]);

  // ==========================================================
  // AUTH LOADING
  // ==========================================================

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FDFDFC] text-[#0B1F3A]">
        <p className="text-sm tracking-[0.2em]">
          LOADING...
        </p>
      </main>
    );
  }

  // ==========================================================
  // LOGIN SCREEN
  // ==========================================================

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FDFDFC] px-6 text-[#0B1F3A]">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold tracking-[0.35em] text-[#7A263A]">
              MODUPEOLA &amp; OLUWASEUN
            </p>

            <h1 className="mt-5 text-4xl font-light">
              Admin Portal
            </h1>

            <div className="mx-auto my-6 h-px w-16 bg-[#B9D7EA]" />

            <p className="text-sm leading-6 text-[#0B1F3A]/55">
              Sign in to manage wedding
              RSVPs, guests and check-ins.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="border border-[#B9D7EA]/60 bg-white p-8 shadow-sm"
          >
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="admin-email"
                  className="mb-2 block text-sm"
                >
                  Email
                </label>

                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  autoComplete="email"
                  className="w-full border-b border-[#0B1F3A]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7A263A]"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2 block text-sm"
                >
                  Password
                </label>

                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  autoComplete="current-password"
                  className="w-full border-b border-[#0B1F3A]/25 bg-transparent px-1 py-3 outline-none transition focus:border-[#7A263A]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {loginError && (
              <div className="mt-6 border border-[#7A263A]/30 bg-[#7A263A]/5 p-4 text-sm text-[#7A263A]">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="mt-8 w-full bg-[#0B1F3A] px-6 py-4 text-sm font-medium tracking-[0.2em] text-white transition hover:bg-[#7A263A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginLoading
                ? "SIGNING IN..."
                : "SIGN IN"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ==========================================================
  // DASHBOARD
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-[#0B1F3A]">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-[#B9D7EA]/50 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-[#7A263A]">
              MODUPEOLA &amp; OLUWASEUN
            </p>

            <h1 className="mt-2 text-2xl font-light">
              Admin Dashboard
            </h1>
          </div>

          <button
            onClick={handleLogout}
            className="border border-[#0B1F3A]/20 px-5 py-2.5 text-xs tracking-[0.15em] transition hover:border-[#7A263A] hover:text-[#7A263A]"
          >
            SIGN OUT
          </button>
        </div>
      </header>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* ====================================================
            TITLE
        ==================================================== */}

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs tracking-[0.25em] text-[#7A263A]">
              WEDDING MANAGEMENT
            </p>

            <h2 className="mt-2 text-3xl font-light">
              Guest Overview
            </h2>

            <p className="mt-2 text-sm text-[#0B1F3A]/50">
              Complete guest roster including
              primary and additional guests.
            </p>
          </div>

          <button
            onClick={() => void loadData()}
            disabled={loadingData}
            className="border border-[#0B1F3A]/20 bg-white px-5 py-3 text-xs tracking-[0.15em] transition hover:border-[#7A263A] hover:text-[#7A263A] disabled:opacity-50"
          >
            {loadingData
              ? "REFRESHING..."
              : "REFRESH DATA"}
          </button>
        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {dataError && (
          <div className="mb-8 border border-[#7A263A]/30 bg-[#7A263A]/5 p-5 text-sm text-[#7A263A]">
            <p className="font-medium">
              Unable to load admin data
            </p>

            <p className="mt-2 break-words">
              {dataError}
            </p>
          </div>
        )}

        {/* ====================================================
            STATISTICS
        ==================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total RSVPs"
            value={totalRSVPs}
          />

          <StatCard
            label="Attending"
            value={attending}
          />

          <StatCard
            label="Declined"
            value={declined}
          />

          <StatCard
            label="Total Guests"
            value={totalGuests}
          />

          <StatCard
            label="Checked In"
            value={checkedIn}
          />
        </div>

        {/* ====================================================
            CHECK-IN SUMMARY
        ==================================================== */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border border-[#B9D7EA]/60 bg-white p-6">
            <p className="text-xs tracking-[0.2em] text-[#7A263A]">
              CHECK-IN STATUS
            </p>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-3xl font-light">
                  {checkedIn}
                </p>

                <p className="mt-1 text-xs text-[#0B1F3A]/50">
                  Checked in
                </p>
              </div>

              <div className="text-right">
                <p className="text-3xl font-light">
                  {notCheckedIn}
                </p>

                <p className="mt-1 text-xs text-[#0B1F3A]/50">
                  Awaiting arrival
                </p>
              </div>
            </div>
          </div>

          <div className="border border-[#B9D7EA]/60 bg-white p-6">
            <p className="text-xs tracking-[0.2em] text-[#7A263A]">
              EVENT
            </p>

            <p className="mt-4 text-xl font-light">
              October 30, 2026
            </p>

            <p className="mt-2 text-sm text-[#0B1F3A]/55">
              Osebosola Memorial Hall
              <br />
              FFF, Oka, Ondo City, Ondo State
            </p>
          </div>
        </div>

        {/* ====================================================
            COMPLETE GUEST LIST
        ==================================================== */}

        <div className="mt-10 border border-[#B9D7EA]/60 bg-white">
          <div className="border-b border-[#B9D7EA]/40 p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-light">
                  Complete Guest List
                </h2>

                <p className="mt-1 text-xs text-[#0B1F3A]/45">
                  {filteredGuests.length} people
                </p>
              </div>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search guests, ticket or table..."
                className="w-full border border-[#0B1F3A]/15 bg-[#F8F9FA] px-4 py-3 text-sm outline-none transition focus:border-[#7A263A] sm:w-80"
              />
            </div>
          </div>

          {/* ==================================================
              DESKTOP TABLE
          ================================================== */}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#B9D7EA]/40 text-left text-xs uppercase tracking-[0.12em] text-[#0B1F3A]/45">
                  <th className="px-6 py-4 font-medium">
                    Guest
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Type
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Primary RSVP
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Ticket
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Table
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Check-in
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredGuests.map((row) => (
                  <tr
                    key={row.rsvpGuest.id}
                    className="border-b border-[#B9D7EA]/30 last:border-0"
                  >
                    {/* NAME */}

                    <td className="px-6 py-5">
                      <p className="font-medium">
                        {row.rsvpGuest.name}
                      </p>
                    </td>

                    {/* TYPE */}

                    <td className="px-6 py-5">
                      {row.isPrimary ? (
                        <span className="inline-flex border border-[#0B1F3A]/20 bg-[#0B1F3A]/5 px-3 py-1 text-xs">
                          PRIMARY
                        </span>
                      ) : (
                        <span className="inline-flex border border-[#B9D7EA] bg-[#F7FAFC] px-3 py-1 text-xs">
                          ADDITIONAL
                        </span>
                      )}
                    </td>

                    {/* RSVP STATUS */}

                    <td className="px-6 py-5">
                      {row.rsvp?.attending ? (
                        <span className="text-xs font-medium text-green-700">
                          ATTENDING
                        </span>
                      ) : row.rsvp ? (
                        <span className="text-xs text-[#7A263A]">
                          DECLINED
                        </span>
                      ) : (
                        <span className="text-xs text-[#0B1F3A]/35">
                          —
                        </span>
                      )}
                    </td>

                    {/* INDIVIDUAL TICKET */}

                    <td className="px-6 py-5">
                      {row.ticket?.ticket_number ? (
                        <span className="font-mono text-sm font-semibold tracking-[0.12em]">
                          {row.ticket.ticket_number}
                        </span>
                      ) : (
                        <span className="text-xs text-[#0B1F3A]/35">
                          NO TICKET
                        </span>
                      )}
                    </td>

                    {/* TABLE */}

                    <td className="px-6 py-5">
                      {row.rsvpGuest.table_number ? (
                        <span className="font-medium text-[#7A263A]">
                          {row.rsvpGuest.table_number}
                        </span>
                      ) : (
                        <span className="text-xs text-[#0B1F3A]/35">
                          —
                        </span>
                      )}
                    </td>

                    {/* CHECK-IN */}

                    <td className="px-6 py-5">
                      {row.ticket ? (
                        row.ticket.checked_in ? (
                          <span className="text-xs font-medium text-green-700">
                            ✓ CHECKED IN
                          </span>
                        ) : (
                          <span className="text-xs text-[#0B1F3A]/45">
                            NOT CHECKED IN
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-[#0B1F3A]/35">
                          NO TICKET
                        </span>
                      )}
                    </td>

                    {/* ACTION */}

                    <td className="px-6 py-5">
                      <button
                        onClick={() =>
                          setSelectedGuest(row)
                        }
                        className="text-xs font-medium tracking-[0.12em] text-[#7A263A] hover:underline"
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ==================================================
              MOBILE
          ================================================== */}

          <div className="md:hidden">
            {filteredGuests.map((row) => (
              <div
                key={row.rsvpGuest.id}
                className="border-b border-[#B9D7EA]/30 p-5 last:border-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.rsvpGuest.name}
                    </p>

                    <p className="mt-1 text-xs text-[#0B1F3A]/50">
                      {row.isPrimary
                        ? "Primary guest"
                        : "Additional guest"}
                    </p>
                  </div>

                  {row.rsvpGuest.table_number && (
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] uppercase tracking-[0.15em] text-[#0B1F3A]/40">
                        TABLE
                      </p>

                      <p className="text-lg font-semibold text-[#7A263A]">
                        {row.rsvpGuest.table_number}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[#0B1F3A]/40">
                      TICKET
                    </p>

                    <p className="mt-1 font-mono text-sm font-semibold tracking-[0.08em]">
                      {row.ticket?.ticket_number ||
                        "NO TICKET"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[#0B1F3A]/40">
                      STATUS
                    </p>

                    <p
                      className={`mt-1 text-xs font-medium ${
                        row.ticket?.checked_in
                          ? "text-green-700"
                          : "text-[#0B1F3A]/50"
                      }`}
                    >
                      {row.ticket?.checked_in
                        ? "✓ CHECKED IN"
                        : "NOT CHECKED IN"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    {row.rsvp?.attending ? (
                      <span className="text-xs font-medium text-green-700">
                        ✓ ATTENDING
                      </span>
                    ) : row.rsvp ? (
                      <span className="text-xs text-[#7A263A]">
                        DECLINED
                      </span>
                    ) : null}
                  </div>

                  <button
                    onClick={() =>
                      setSelectedGuest(row)
                    }
                    className="text-xs tracking-[0.12em] text-[#7A263A]"
                  >
                    VIEW
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ==================================================
              EMPTY
          ================================================== */}

          {filteredGuests.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm text-[#0B1F3A]/45">
                No guests found.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedGuest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/50 px-5 py-8"
          onClick={() =>
            setSelectedGuest(null)
          }
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div className="flex items-center justify-between border-b border-[#B9D7EA]/40 p-6">
              <div>
                <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                  GUEST DETAILS
                </p>

                <h2 className="mt-2 text-2xl font-light">
                  {selectedGuest.rsvpGuest.name}
                </h2>

                <p className="mt-1 text-xs text-[#0B1F3A]/45">
                  {selectedGuest.isPrimary
                    ? "Primary Guest"
                    : "Additional Guest"}
                </p>
              </div>

              <button
                onClick={() =>
                  setSelectedGuest(null)
                }
                className="text-2xl font-light text-[#0B1F3A]/50 hover:text-[#7A263A]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-7 p-6">
              {/* ==================================================
                  INDIVIDUAL TICKET
              ================================================== */}

              <div className="border border-[#B9D7EA]/60 bg-[#F8F9FA] p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                      INDIVIDUAL TICKET
                    </p>

                    <p className="mt-3 font-mono text-3xl font-semibold tracking-[0.15em]">
                      {selectedGuest.ticket
                        ?.ticket_number ||
                        "NO TICKET"}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-xs uppercase tracking-[0.15em] text-[#0B1F3A]/40">
                      CHECK-IN
                    </p>

                    <p
                      className={`mt-2 text-sm font-medium ${
                        selectedGuest.ticket
                          ?.checked_in
                          ? "text-green-700"
                          : "text-[#0B1F3A]/50"
                      }`}
                    >
                      {selectedGuest.ticket
                        ? selectedGuest.ticket
                            .checked_in
                          ? "✓ CHECKED IN"
                          : "NOT CHECKED IN"
                        : "NO TICKET"}
                    </p>
                  </div>
                </div>

                {selectedGuest.ticket && (
                  <button
                    onClick={() =>
                      void toggleCheckIn(
                        selectedGuest.ticket!
                      )
                    }
                    disabled={
                      updatingTicketId ===
                      selectedGuest.ticket.id
                    }
                    className={`mt-5 w-full px-5 py-3 text-xs tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedGuest.ticket
                        .checked_in
                        ? "bg-[#7A263A] hover:bg-[#0B1F3A]"
                        : "bg-[#0B1F3A] hover:bg-[#7A263A]"
                    }`}
                  >
                    {updatingTicketId ===
                    selectedGuest.ticket.id
                      ? "UPDATING..."
                      : selectedGuest.ticket
                          .checked_in
                      ? "UNDO CHECK-IN"
                      : "CHECK IN"}
                  </button>
                )}
              </div>

              {/* ==================================================
                  TABLE
              ================================================== */}

              <div className="border border-[#7A263A]/30 bg-[#7A263A]/5 p-6 text-center">
                <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                  TABLE ASSIGNMENT
                </p>

                <p className="mt-3 text-4xl font-light text-[#7A263A]">
                  {selectedGuest.rsvpGuest
                    .table_number
                    ? `TABLE ${selectedGuest.rsvpGuest.table_number}`
                    : "NOT ASSIGNED"}
                </p>

                <p className="mt-2 text-xs text-[#0B1F3A]/40">
                  Table assignments are managed
                  separately.
                </p>
              </div>

              {/* ==================================================
                  CONTACT
              ================================================== */}

              {selectedGuest.primaryGuest && (
                <div className="space-y-5">
                  <DetailRow
                    label="Primary Guest"
                    value={`${selectedGuest.primaryGuest.first_name} ${selectedGuest.primaryGuest.last_name}`}
                  />

                  <DetailRow
                    label="Email"
                    value={
                      selectedGuest.primaryGuest
                        .email
                    }
                  />

                  <DetailRow
                    label="Phone"
                    value={
                      selectedGuest.primaryGuest
                        .phone ||
                      "Not provided"
                    }
                  />
                </div>
              )}

              {/* ==================================================
                  RSVP
              ================================================== */}

              <div className="space-y-5">
                <DetailRow
                  label="RSVP"
                  value={
                    selectedGuest.rsvp
                      ? selectedGuest.rsvp
                          .attending
                        ? "Attending"
                        : "Declined"
                      : "No RSVP"
                  }
                />

                <DetailRow
                  label="Guest Type"
                  value={
                    selectedGuest.rsvpGuest
                      .guest_type
                  }
                />

                {selectedGuest.rsvp && (
                  <DetailRow
                    label="Party Size"
                    value={String(
                      selectedGuest.rsvp
                        .guest_count
                    )}
                  />
                )}

                {selectedGuest.rsvp
                  ?.meal_preference && (
                  <DetailRow
                    label="Meal Preference"
                    value={
                      selectedGuest.rsvp
                        .meal_preference
                    }
                  />
                )}

                {selectedGuest.rsvp
                  ?.dietary_requirements && (
                  <DetailRow
                    label="Dietary Requirements"
                    value={
                      selectedGuest.rsvp
                        .dietary_requirements
                    }
                  />
                )}
              </div>

              {/* ==================================================
                  PARTY
              ================================================== */}

              <div className="border-t border-[#B9D7EA]/40 pt-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                      PARTY
                    </p>

                    <h3 className="mt-2 text-xl font-light">
                      Party Members
                    </h3>
                  </div>

                  <p className="text-xs text-[#0B1F3A]/45">
                    {
                      selectedParty.filter(
                        (member) =>
                          member.ticket
                            ?.checked_in
                      ).length
                    }{" "}
                    of {selectedParty.length}{" "}
                    checked in
                  </p>
                </div>

                <div className="mt-5 overflow-hidden border border-[#B9D7EA]/50">
                  {selectedParty.map(
                    (member, index) => {
                      const checkedIn =
                        member.ticket
                          ?.checked_in;

                      return (
                        <div
                          key={
                            member.rsvpGuest.id
                          }
                          className={`p-4 ${
                            index > 0
                              ? "border-t border-[#B9D7EA]/40"
                              : ""
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {
                                    member
                                      .rsvpGuest
                                      .name
                                  }
                                </p>

                                {member.isPrimary && (
                                  <span className="border border-[#0B1F3A]/15 bg-[#0B1F3A]/5 px-2 py-0.5 text-[9px] tracking-[0.1em]">
                                    PRIMARY
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#0B1F3A]/45">
                                <span>
                                  Ticket:{" "}
                                  <span className="font-mono font-medium text-[#0B1F3A]/70">
                                    {member
                                      .ticket
                                      ?.ticket_number ||
                                      "—"}
                                  </span>
                                </span>

                                <span>
                                  Table:{" "}
                                  <span className="font-medium text-[#7A263A]">
                                    {member
                                      .rsvpGuest
                                      .table_number ||
                                      "—"}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <span
                                className={`text-xs font-medium ${
                                  checkedIn
                                    ? "text-green-700"
                                    : "text-[#0B1F3A]/45"
                                }`}
                              >
                                {checkedIn
                                  ? "✓ CHECKED IN"
                                  : "NOT CHECKED IN"}
                              </span>

                              {member.ticket && (
                                <button
                                  onClick={() =>
                                    void toggleCheckIn(
                                      member.ticket!
                                    )
                                  }
                                  disabled={
                                    updatingTicketId ===
                                    member.ticket
                                      .id
                                  }
                                  className={`px-3 py-2 text-[10px] tracking-[0.08em] text-white transition disabled:opacity-50 ${
                                    checkedIn
                                      ? "bg-[#7A263A] hover:bg-[#0B1F3A]"
                                      : "bg-[#0B1F3A] hover:bg-[#7A263A]"
                                  }`}
                                >
                                  {updatingTicketId ===
                                  member.ticket
                                    .id
                                    ? "..."
                                    : checkedIn
                                    ? "UNDO"
                                    : "CHECK IN"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* ==================================================
                  MESSAGE
              ================================================== */}

              {selectedGuest.rsvp?.message && (
                <div className="border-t border-[#B9D7EA]/40 pt-6">
                  <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                    MESSAGE
                  </p>

                  <p className="mt-3 text-sm leading-7 text-[#0B1F3A]/65">
                    {selectedGuest.rsvp.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border border-[#B9D7EA]/60 bg-white p-6">
      <p className="text-xs uppercase tracking-[0.16em] text-[#0B1F3A]/45">
        {label}
      </p>

      <p className="mt-4 text-3xl font-light">
        {value}
      </p>
    </div>
  );
}

// ============================================================
// DETAIL ROW
// ============================================================

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] text-[#7A263A]">
        {label}
      </p>

      <p className="mt-2 text-sm text-[#0B1F3A]/70">
        {value}
      </p>
    </div>
  );
}