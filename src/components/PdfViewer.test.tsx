import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { PdfViewer } from "./PdfViewer";

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  loaded: undefined as undefined | ((pdf: { numPages: number }) => void),
  failed: undefined as undefined | (() => void),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: mocks.sign }) } },
}));

// PDF.js uses a real worker/canvas in browsers, which jsdom cannot render.
// Only that boundary is substituted; signing, viewer state, focus, and controls
// exercise the actual component. Real PDF rendering is checked in Chromium.
vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ file, children, onLoadSuccess, onLoadError }: {
    file: string; children: ReactNode;
    onLoadSuccess: (pdf: { numPages: number }) => void;
    onLoadError: () => void;
  }) => {
    mocks.loaded = onLoadSuccess;
    mocks.failed = onLoadError;
    return <div data-testid="pdf-document" data-file={file}>{children}</div>;
  },
  Page: ({ pageNumber, scale }: { pageNumber: number; scale: number }) =>
    <div data-testid="pdf-page" data-page={pageNumber} data-scale={scale} />,
}));

describe("PdfViewer", () => {
  beforeEach(() => {
    mocks.sign.mockReset();
    mocks.loaded = undefined;
    mocks.failed = undefined;
    mocks.sign.mockImplementation(async (_path: string, _ttl: number, options?: { download: string }) =>
      ({ data: { signedUrl: options ? "/fresh-download.pdf" : "/fresh-view.pdf" }, error: null }));
  });

  it("signs a private resource and reads every page inside the app", async () => {
    render(<PdfViewer title="Driver handbook" filePath="guides/handbook.pdf" onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Driver handbook" })).toBeInTheDocument();
    await screen.findByTestId("pdf-document");
    expect(mocks.sign).toHaveBeenCalledWith("guides/handbook.pdf", 3600);
    expect(screen.getByTestId("pdf-document")).toHaveAttribute("data-file", "/fresh-view.pdf");
    act(() => mocks.loaded?.({ numPages: 3 }));
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-page")).toHaveAttribute("data-page", "2");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("pdf-page")).toHaveAttribute("data-scale", "1.25");
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute("href", "/fresh-download.pdf");
    expect(screen.getByRole("link", { name: "Download PDF" })).not.toHaveAttribute("target", "_blank");
  });

  it("shows a safe error and refreshes signed links when the reader fails", async () => {
    render(<PdfViewer title="Guide" filePath="guide.pdf" onClose={vi.fn()} />);
    await screen.findByTestId("pdf-document");
    act(() => mocks.failed?.());
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to display this PDF");
    mocks.sign.mockImplementation(async () => ({ data: { signedUrl: "/renewed.pdf" }, error: null }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByTestId("pdf-document")).toHaveAttribute("data-file", "/renewed.pdf"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles a denied signed-link request without exposing backend details", async () => {
    mocks.sign.mockResolvedValue({ data: null, error: { message: "secret backend detail" } });
    render(<PdfViewer title="Guide" filePath="guide.pdf" onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this PDF");
    expect(screen.queryByText("secret backend detail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pdf-document")).not.toBeInTheDocument();
  });

  it("closes with Escape, traps focus, and restores the opener and scrolling", async () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = "auto";
    const { unmount } = render(<PdfViewer title="Guide" filePath="guide.pdf" onClose={onClose} />);
    await screen.findByTestId("pdf-document");
    const close = screen.getByRole("button", { name: "Close PDF" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).not.toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("auto");
    opener.remove();
    document.body.style.overflow = "";
  });
});
