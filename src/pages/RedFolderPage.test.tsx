import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RedFolderPage } from "./RedFolderPage";

vi.mock("../hooks/useAsync", () => ({ useAsync: () => ({ loading: false, error: null, data: [
  { id: "pdf", title: "Driver handbook", content: "Read this guide", kind: "handbook", file_type: "pdf", file_path: "guide.pdf" },
  { id: "image", title: "Setup photo", kind: "handbook", file_type: "image", file_path: "setup.jpg" },
] }) }));
vi.mock("../lib/supabase", () => ({ supabase: { storage: { from: () => ({
  createSignedUrl: async () => ({ data: { signedUrl: "/private-file" }, error: null }),
}) } } }));
vi.mock("../components/PdfViewer", () => ({
  PdfViewer: ({ title, onClose }: { title: string; onClose: () => void }) =>
    <div role="dialog" aria-label={title}><button onClick={onClose}>Close PDF</button></div>,
}));

describe("Red Folder PDF entry", () => {
  it("opens and closes a PDF reader without navigating away or changing images", async () => {
    render(<MemoryRouter><RedFolderPage /></MemoryRouter>);
    const view = await screen.findByRole("button", { name: "View PDF" });
    expect(screen.queryByRole("link", { name: "View PDF" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Setup photo" })).toBeInTheDocument();
    fireEvent.click(view);
    const reader = await screen.findByRole("dialog", { name: "Driver handbook" });
    fireEvent.click(within(reader).getByRole("button", { name: "Close PDF" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Red Folder" })).toBeInTheDocument();
  });
});
