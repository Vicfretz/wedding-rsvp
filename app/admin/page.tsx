"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  guest_id: string;
  qr_token: string;
  checked_in: boolean;
};

type GuestRow = {
  guest: Guest;
  rsvp?: RSVP;
  ticket?: Ticket;
};

export default function AdminPage() {
  const supabase = createClient();

  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [guests, setGuests] = useState<Guest[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  const [search, setSearch] = useState("");

  const [selectedGuest, setSelectedGuest] =
    useState<GuestRow | null>(null);

  // =========================================================
  // CHECK AUTHENTICATION
  // =========================================================

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setCheckingAuth(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setCheckingAuth(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =========================================================
  // LOAD ADMIN DATA
  // =========================================================

  useEffect(() => {
    if (!session) return;

    loadData();
  }, [session]);

  async function loadData() {
    setLoadingData(true);
    setDataError("");

    try {
      const [
        guestsResult,
        rsvpsResult,
        ticketsResult,
      ] = await Promise.all([
        supabase
          .from("guests")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("rsvps")
          .select("*"),

        supabase
          .from("tickets")
          .select("*"),
      ]);

      if (guestsResult.error) {
        throw guestsResult.error;
      }

      if (rsvpsResult.error) {
        throw rsvpsResult.error;
      }

      if (ticketsResult.error) {
        throw ticketsResult.error;
      }

      setGuests(guestsResult.data || []);
      setRsvps(rsvpsResult.data || []);
      setTickets(ticketsResult.data || []);

    } catch (error: any) {
      console.error("Admin data error:", error);

      setDataError(
        error?.message ||
          "Unable to load wedding data."
      );
    } finally {
      setLoadingData(false);
    }
  }

  // =========================================================
  // LOGIN
  // =========================================================

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoginLoading(true);
    setLoginError("");

    const {
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError(
        error.message ||
          "Unable to sign in."
      );
    }

    setLoginLoading(false);
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    setGuests([]);
    setRsvps([]);
    setTickets([]);
    setSelectedGuest(null);
  }

  // =========================================================
  // CHECK IN GUEST
  // =========================================================

  async function toggleCheckIn(
    ticket: Ticket
  ) {
    const newStatus = !ticket.checked_in;

    const {
      error,
    } = await supabase
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

      return;
    }

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

    setSelectedGuest((current) => {
      if (!current || !current.ticket) {
        return current;
      }

      if (current.ticket.id !== ticket.id) {
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
  }

  // =========================================================
  // COMBINE DATABASE DATA
  // =========================================================

  const guestRows: GuestRow[] = useMemo(() => {
    return guests.map((guest) => ({
      guest,

      rsvp: rsvps.find(
        (rsvp) =>
          rsvp.guest_id === guest.id
      ),

      ticket: tickets.find(
        (ticket) =>
          ticket.guest_id === guest.id
      ),
    }));
  }, [guests, rsvps, tickets]);

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredGuests = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) {
      return guestRows;
    }

    return guestRows.filter((row) => {
      const fullName =
        `${row.guest.first_name} ${row.guest.last_name}`
          .toLowerCase();

      const email =
        row.guest.email.toLowerCase();

      const phone =
        row.guest.phone?.toLowerCase() || "";

      return (
        fullName.includes(query) ||
        email.includes(query) ||
        phone.includes(query)
      );
    });
  }, [guestRows, search]);

  // =========================================================
  // STATISTICS
  // =========================================================

  const totalRSVPs = rsvps.length;

  const attending = rsvps.filter(
    (rsvp) => rsvp.attending
  ).length;

  const declined = rsvps.filter(
    (rsvp) => !rsvp.attending
  ).length;

  const totalGuests = rsvps
    .filter((rsvp) => rsvp.attending)
    .reduce(
      (total, rsvp) =>
        total + (rsvp.guest_count || 0),
      0
    );

  const checkedIn = tickets.filter(
    (ticket) => ticket.checked_in
  ).length;

  const notCheckedIn = tickets.filter(
    (ticket) => !ticket.checked_in
  ).length;

  // =========================================================
  // LOADING AUTH
  // =========================================================

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FDFDFC] text-[#0B1F3A]">
        <p className="text-sm tracking-[0.2em]">
          LOADING...
        </p>
      </main>
    );
  }

  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FDFDFC] px-6 text-[#0B1F3A]">

        <div className="w-full max-w-md">

          <div className="mb-10 text-center">

            <p className="text-xs font-semibold tracking-[0.35em] text-[#7A263A]">
              MODUPEOLA & OLUSEUN
            </p>

            <h1 className="mt-5 text-4xl font-light">
              Admin Portal
            </h1>

            <div className="mx-auto my-6 h-px w-16 bg-[#B9D7EA]" />

            <p className="text-sm leading-6 text-[#0B1F3A]/55">
              Sign in to manage wedding RSVPs,
              guests and check-ins.
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

          <p className="mt-6 text-center text-xs text-[#0B1F3A]/40">
            Wedding administration portal
          </p>

        </div>

      </main>
    );
  }

  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-[#0B1F3A]">

      {/* HEADER */}

      <header className="border-b border-[#B9D7EA]/50 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">

          <div>

            <p className="text-xs font-semibold tracking-[0.3em] text-[#7A263A]">
              MODUPEOLA & OLUSEUN
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


      {/* CONTENT */}

      <section className="mx-auto max-w-7xl px-6 py-10">


        {/* TOP BAR */}

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

          <div>

            <p className="text-xs tracking-[0.25em] text-[#7A263A]">
              WEDDING MANAGEMENT
            </p>

            <h2 className="mt-2 text-3xl font-light">
              Guest Overview
            </h2>

          </div>


          <button
            onClick={loadData}
            disabled={loadingData}
            className="border border-[#0B1F3A]/20 bg-white px-5 py-3 text-xs tracking-[0.15em] transition hover:border-[#7A263A] hover:text-[#7A263A] disabled:opacity-50"
          >
            {loadingData
              ? "REFRESHING..."
              : "REFRESH DATA"}
          </button>

        </div>


        {/* ERROR */}

        {dataError && (

          <div className="mb-8 border border-[#7A263A]/30 bg-[#7A263A]/5 p-5 text-sm text-[#7A263A]">
            {dataError}
          </div>

        )}


        {/* STATISTICS */}

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


        {/* CHECK-IN SUMMARY */}

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

              <div>

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


        {/* GUEST LIST */}

        <div className="mt-10 border border-[#B9D7EA]/60 bg-white">

          <div className="border-b border-[#B9D7EA]/40 p-6">

            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

              <div>

                <h2 className="text-xl font-light">
                  Guest List
                </h2>

                <p className="mt-1 text-xs text-[#0B1F3A]/45">
                  {filteredGuests.length} guest records
                </p>

              </div>


              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search guests..."
                className="w-full border border-[#0B1F3A]/15 bg-[#F8F9FA] px-4 py-3 text-sm outline-none transition focus:border-[#7A263A] sm:w-72"
              />

            </div>

          </div>


          {/* DESKTOP TABLE */}

          <div className="hidden overflow-x-auto md:block">

            <table className="w-full">

              <thead>

                <tr className="border-b border-[#B9D7EA]/40 text-left text-xs uppercase tracking-[0.12em] text-[#0B1F3A]/45">

                  <th className="px-6 py-4 font-medium">
                    Guest
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Contact
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Guests
                  </th>

                  <th className="px-6 py-4 font-medium">
                    RSVP
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
                    key={row.guest.id}
                    className="border-b border-[#B9D7EA]/30 last:border-0"
                  >

                    <td className="px-6 py-5">

                      <p className="font-medium">
                        {row.guest.first_name}{" "}
                        {row.guest.last_name}
                      </p>

                    </td>


                    <td className="px-6 py-5">

                      <p className="text-sm">
                        {row.guest.email}
                      </p>

                      {row.guest.phone && (
                        <p className="mt-1 text-xs text-[#0B1F3A]/45">
                          {row.guest.phone}
                        </p>
                      )}

                    </td>


                    <td className="px-6 py-5 text-sm">

                      {row.rsvp?.attending
                        ? row.rsvp.guest_count
                        : "—"}

                    </td>


                    <td className="px-6 py-5">

                      {row.rsvp?.attending ? (

                        <span className="inline-flex border border-green-600/20 bg-green-50 px-3 py-1 text-xs text-green-700">
                          ATTENDING
                        </span>

                      ) : row.rsvp ? (

                        <span className="inline-flex border border-[#7A263A]/20 bg-[#7A263A]/5 px-3 py-1 text-xs text-[#7A263A]">
                          DECLINED
                        </span>

                      ) : (

                        <span className="text-xs text-[#0B1F3A]/40">
                          NO RSVP
                        </span>

                      )}

                    </td>


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


          {/* MOBILE LIST */}

          <div className="md:hidden">

            {filteredGuests.map((row) => (

              <div
                key={row.guest.id}
                className="border-b border-[#B9D7EA]/30 p-5 last:border-0"
              >

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <p className="font-medium">
                      {row.guest.first_name}{" "}
                      {row.guest.last_name}
                    </p>

                    <p className="mt-1 text-xs text-[#0B1F3A]/50">
                      {row.guest.email}
                    </p>

                  </div>


                  {row.rsvp?.attending ? (

                    <span className="text-xs text-green-700">
                      ✓
                    </span>

                  ) : (

                    <span className="text-xs text-[#7A263A]">
                      ✕
                    </span>

                  )}

                </div>


                <div className="mt-4 flex items-center justify-between">

                  <div className="text-xs text-[#0B1F3A]/50">

                    Guests:{" "}

                    <span className="text-[#0B1F3A]">
                      {row.rsvp?.attending
                        ? row.rsvp.guest_count
                        : "—"}
                    </span>

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


          {filteredGuests.length === 0 && (

            <div className="p-12 text-center">

              <p className="text-sm text-[#0B1F3A]/45">
                No guests found.
              </p>

            </div>

          )}

        </div>

      </section>


      {/* =====================================================
          GUEST DETAIL MODAL
      ===================================================== */}

      {selectedGuest && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/50 px-5 py-8">

          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white">

            <div className="flex items-center justify-between border-b border-[#B9D7EA]/40 p-6">

              <div>

                <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                  GUEST DETAILS
                </p>

                <h2 className="mt-2 text-2xl font-light">
                  {selectedGuest.guest.first_name}{" "}
                  {selectedGuest.guest.last_name}
                </h2>

              </div>


              <button
                onClick={() =>
                  setSelectedGuest(null)
                }
                className="text-2xl font-light text-[#0B1F3A]/50 hover:text-[#7A263A]"
              >
                ×
              </button>

            </div>


            <div className="space-y-7 p-6">

              <DetailRow
                label="Email"
                value={selectedGuest.guest.email}
              />

              <DetailRow
                label="Phone"
                value={
                  selectedGuest.guest.phone ||
                  "Not provided"
                }
              />


              <DetailRow
                label="RSVP"
                value={
                  selectedGuest.rsvp
                    ? selectedGuest.rsvp.attending
                      ? "Attending"
                      : "Declined"
                    : "No RSVP"
                }
              />


              {selectedGuest.rsvp?.attending && (

                <>
                  <DetailRow
                    label="Number of Guests"
                    value={String(
                      selectedGuest.rsvp.guest_count
                    )}
                  />

                  <DetailRow
                    label="Additional Guests"
                    value={
                      selectedGuest.rsvp
                        .additional_guest_names ||
                      "None"
                    }
                  />

                  <DetailRow
                    label="Meal Preference"
                    value={
                      selectedGuest.rsvp
                        .meal_preference ||
                      "Not specified"
                    }
                  />

                  <DetailRow
                    label="Dietary Requirements"
                    value={
                      selectedGuest.rsvp
                        .dietary_requirements ||
                      "None"
                    }
                  />

                </>

              )}


              {selectedGuest.rsvp?.message && (

                <div>

                  <p className="text-xs uppercase tracking-[0.15em] text-[#7A263A]">
                    Message
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#0B1F3A]/70">
                    {selectedGuest.rsvp.message}
                  </p>

                </div>

              )}


              {/* TICKET */}

              {selectedGuest.ticket && (

                <div className="border-t border-[#B9D7EA]/40 pt-6">

                  <p className="text-xs tracking-[0.2em] text-[#7A263A]">
                    DIGITAL TICKET
                  </p>

                  <div className="mt-4 flex items-center justify-between">

                    <div>

                      <p className="text-sm">
                        Ticket status
                      </p>

                      <p className="mt-1 text-xs text-[#0B1F3A]/50">

                        {selectedGuest.ticket.checked_in
                          ? "Guest has checked in"
                          : "Guest has not checked in"}

                      </p>

                    </div>


                    <button
                      onClick={() =>
                        toggleCheckIn(
                          selectedGuest.ticket!
                        )
                      }
                      className={`px-5 py-3 text-xs tracking-[0.12em] text-white transition ${
                        selectedGuest.ticket.checked_in
                          ? "bg-[#7A263A] hover:bg-[#0B1F3A]"
                          : "bg-[#0B1F3A] hover:bg-[#7A263A]"
                      }`}
                    >

                      {selectedGuest.ticket.checked_in
                        ? "UNDO CHECK-IN"
                        : "CHECK IN"}

                    </button>

                  </div>

                </div>

              )}

            </div>

          </div>

        </div>

      )}

    </main>
  );
}


// =========================================================
// STAT CARD
// =========================================================

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


// =========================================================
// DETAIL ROW
// =========================================================

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