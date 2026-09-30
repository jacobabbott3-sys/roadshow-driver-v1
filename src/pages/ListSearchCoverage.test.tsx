import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ListSearch } from "../components/ListSearch";
import { matchesListSearch, sortList } from "../lib/listControls";

const pageFiles = [
  "AdminSigningsPage.tsx", "AdminTemplatesPage.tsx", "AdminChecklistsPage.tsx",
  "AdminOperationsPage.tsx", "ResourcesPage.tsx", "RedFolderPage.tsx",
  "DirectoryPage.tsx", "ToolbagPage.tsx", "FaqPage.tsx", "ContractsPage.tsx",
  "AdminShowsPage.tsx", "AdminUsersPage.tsx",
];

const cases = [
  ["signings", "jose", ["José Alvarez", "Ball Arena", "Denver", "Oct 4"]],
  ["templates", "ratchet", ["Setup Kit", "Toolbag", "Ratchet strap"]],
  ["reviews", "returned", ["Boise Expo", "Alex Driver", "Returned"]],
  ["resources", "operating", ["Red Folder", "Pictures and operating guides"]],
  ["directory", "admin", ["Blair Smith", "Administrator", "555-0102"]],
  ["toolbags", "27", ["Toolbag 27", "Alex Driver", "Socket set"]],
] as const;

describe("operational list search", () => {
  it.each(cases)("matches the declared %s fields", (_screenName, query, fields) => {
    expect(matchesListSearch(query, ...fields)).toBe(true);
    expect(matchesListSearch("not-present", ...fields)).toBe(false);
  });

  it("clearing search restores the original date-sorted order", () => {
    function Harness() {
      const [query, setQuery] = useState("zoo");
      const items = sortList(
        [{ name: "Zoo", date: "2026-10-02" }, { name: "Alpine", date: "2026-10-01" }].filter((item) => matchesListSearch(query, item.name)),
        "date", (item) => item.name, (item) => item.date,
      );
      return <div data-theme="dark"><ListSearch value={query} onChange={setQuery} placeholder="Search" label="Search test list" resultCount={items.length} />{items.map((item) => <span key={item.name}>{item.name}</span>)}</div>;
    }
    render(<Harness />);
    expect(screen.queryByText("Alpine")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByText(/Alpine|Zoo/).map((item) => item.textContent)).toEqual(["Alpine", "Zoo"]);
  });

  it("uses the shared control on every bounded operational page", () => {
    for (const file of pageFiles) {
      expect(readFileSync(`${process.cwd()}/src/pages/${file}`, "utf8"), file).toContain("<ListSearch");
    }
  });
});
