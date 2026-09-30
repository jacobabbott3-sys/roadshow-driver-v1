import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { AdminHeader } from "../components/AdminNav";
import { MutationNotice } from "../components/MutationNotice";
import { ListSearch } from "../components/ListSearch";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { useMutationFeedback } from "../hooks/useMutationFeedback";
import { getUsers, updateUser } from "../lib/adminData";
import { matchesListSearch } from "../lib/listControls";

export function AdminUsersPage() {
  const query = useAsync(getUsers, []);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const mutation = useMutationFeedback();
  async function change(
    id: string,
    role: "driver" | "admin",
    active: boolean,
  ) {
    setBusy(id);
    try {
      await mutation.run(async () => {
        await updateUser(id, role, active);
        await query.refresh();
      }, { successMessage: "User access updated." });
    } catch { /* MutationNotice presents the failure and retry. */ }
    finally { setBusy(""); }
  }
  const users = query.data?.filter((user) => matchesListSearch(search, user.full_name, user.role, user.phone, user.is_active ? "active" : "inactive"));
  return (
    <main className="page">
      <AdminHeader
        eyebrow="TEAM"
        title="Users"
        description="Manage driver access and roles. Passwords remain private."
        backTo="/admin"
      />
      <ListSearch value={search} onChange={setSearch} placeholder="Search names, roles, or phone numbers" label="Search users" resultCount={users?.length || 0} />
      <PageState
        loading={query.loading}
        error={query.error}
        empty={!query.data?.length}
      >
        {!users?.length ? <div className="inline-empty">No users match “{search}”.</div> : <div className="user-grid">
          {users?.map((user) => (
            <article className="user-card" key={user.id}>
              <div className="profile-avatar">
                <UserRound />
              </div>
              <div className="user-main">
                <h2>{user.full_name || "Unnamed user"}</h2>
                <p>
                  <Mail /> Account email is private to authentication
                </p>
                {user.phone && (
                  <p>
                    <Phone /> {user.phone}
                  </p>
                )}
              </div>
              <div className="user-controls">
                <label>
                  Role
                  <select
                    disabled={busy === user.id}
                    value={user.role}
                    onChange={(event) =>
                      void change(
                        user.id,
                        event.target.value as "driver" | "admin",
                        user.is_active,
                      )
                    }
                  >
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button
                  className={user.is_active ? "active-user" : "inactive-user"}
                  disabled={busy === user.id}
                  onClick={() =>
                    void change(user.id, user.role, !user.is_active)
                  }
                >
                  {user.is_active ? "Active" : "Inactive"}
                </button>
              </div>
              {user.role === "admin" && (
                <ShieldCheck className="admin-badge" />
              )}
            </article>
          ))}
        </div>}
      </PageState>
      <div className="notice secure-note">
        <ShieldCheck /> Admins can trigger password recovery from Supabase
        Authentication, but cannot view or retrieve anyone’s password.
      </div>
      <MutationNotice state={mutation.state} message={mutation.message} onRetry={() => void mutation.retry().catch(() => undefined)} onDismiss={mutation.clear} />
    </main>
  );
}
