import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";

const getSummaries = vi.fn();
const getMessages = vi.fn();
const markRead = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me" }, profile: { role: "driver" } }),
}));
vi.mock("../lib/driverData", () => ({ getDirectory: vi.fn(async () => []) }));
vi.mock("../lib/communications", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/communications")>();
  return {
    ...original,
    getChatThreadSummaries: (...args: unknown[]) => getSummaries(...args),
    getChatMessages: (...args: unknown[]) => getMessages(...args),
    markChatRead: (...args: unknown[]) => markRead(...args),
    createChat: vi.fn(),
    sendChatMessage: vi.fn(),
  };
});
vi.mock("../lib/supabase", () => ({
  supabase: {
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  },
}));

describe("ChatPage pagination", () => {
  beforeEach(() => {
    getSummaries.mockReset().mockResolvedValue([{
      id: "thread-1", subject: "Denver crew", created_by: "me",
      created_at: "2026-09-29T09:00:00Z", updated_at: "2026-09-29T12:00:00Z",
      members: [
        { user_id: "me", read_at: null, profile: { full_name: "Me", role: "driver" } },
        { user_id: "alex", read_at: null, profile: { full_name: "Alex", role: "driver" } },
      ],
      latest_message: chatMessage("51", "2026-09-29T12:00:00Z"), unread: true,
    }]);
    const firstPage = Array.from({ length: 50 }, (_, index) => chatMessage(String(index + 2), new Date(Date.UTC(2026, 8, 29, 10, index)).toISOString()));
    getMessages.mockReset()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([chatMessage("1", "2026-09-29T10:00:00Z"), chatMessage("2", "2026-09-29T11:00:00Z")]);
    markRead.mockReset().mockResolvedValue(undefined);
  });

  it("loads summaries and only the selected thread's messages, then de-duplicates earlier pages", async () => {
    render(<MemoryRouter initialEntries={["/chat?thread=thread-1"]}><ChatPage /></MemoryRouter>);
    expect(await screen.findAllByText("Denver crew")).toHaveLength(2);
    expect(getSummaries).toHaveBeenCalledWith({ search: "", limit: 50 });
    expect(getMessages).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("message 2")).toBeInTheDocument();
    await waitFor(() => expect(markRead).toHaveBeenCalledWith("thread-1"));

    fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
    expect(await screen.findByText("message 1")).toBeInTheDocument();
    expect(screen.getAllByText("message 2")).toHaveLength(1);
  });

  it("searches summaries without loading every thread's messages", async () => {
    render(<MemoryRouter initialEntries={["/chat"]}><ChatPage /></MemoryRouter>);
    const input = await screen.findByRole("searchbox", { name: "Search chats" });
    fireEvent.change(input, { target: { value: "Alex" } });
    await waitFor(() => expect(getSummaries).toHaveBeenLastCalledWith({ search: "Alex", limit: 50 }));
    expect(getMessages).not.toHaveBeenCalled();
  });
});

function chatMessage(id: string, created_at: string) {
  return { id, thread_id: "thread-1", sender_id: "alex", body: `message ${id}`, created_at, sender: { full_name: "Alex" } };
}
