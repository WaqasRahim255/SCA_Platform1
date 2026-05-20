import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#05050c] text-[#aaa8bd]">
      <Outlet />
    </div>
  );
}
