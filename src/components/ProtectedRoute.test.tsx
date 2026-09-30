import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminRoute, ProtectedRoute } from "./ProtectedRoute";

const auth = vi.hoisted(() => ({
  user: { id: "user-1" } as unknown,
  profile: { id: "user-1", full_name: "Driver", role: "driver", is_active: true } as unknown,
  loading: false,
  signOut: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    auth.user = { id: "user-1" };
    auth.profile = { id: "user-1", full_name: "Driver", role: "driver", is_active: true };
    auth.loading = false;
  });

  it("never renders protected content for an inactive cached session", () => {
    auth.profile = { id: "user-1", full_name: "Driver", role: "driver", is_active: false };
    renderProtected(<p>Protected content</p>);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your account is inactive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("allows an active administrator through both route guards", () => {
    auth.profile = { id: "user-1", full_name: "Admin", role: "admin", is_active: true };
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes><Route element={<ProtectedRoute />}><Route element={<AdminRoute />}><Route path="/admin" element={<p>Admin content</p>} /></Route></Route></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });
});

function renderProtected(element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes><Route element={<ProtectedRoute />}><Route path="/" element={element} /></Route></Routes>
    </MemoryRouter>,
  );
}
