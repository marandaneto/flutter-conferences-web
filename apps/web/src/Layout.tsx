import { NavLink, Outlet } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

export function Layout() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-500">
          Flutter Conferences
        </h1>
        <nav className="flex gap-1 flex-wrap">
          <NavLink to="/" end className={navClass}>
            Upcoming
          </NavLink>
          <NavLink to="/past" className={navClass}>
            Past
          </NavLink>
          <NavLink to="/suggest" className={navClass}>
            Suggest
          </NavLink>
          <NavLink to="/admin" className={navClass}>
            Admin
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="mt-12 text-sm text-slate-500">
        <a className="underline" href={`${import.meta.env.VITE_API_URL ?? ""}/conferences.ics`}>
          iCalendar
        </a>{" "}
        ·{" "}
        <a
          className="underline"
          href="https://creativecommons.org/publicdomain/zero/1.0/"
        >
          CC0
        </a>
      </footer>
    </div>
  );
}
