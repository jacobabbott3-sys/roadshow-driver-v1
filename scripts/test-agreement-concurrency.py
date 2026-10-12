#!/usr/bin/env python3
"""Native multi-session regressions; Docker + Python stdlib, synthetic data only.

Creates its own network-isolated PostgreSQL container, exposes no ports, accepts
no database URL/credentials, and removes the container/volume even on test failure.
The fixture stubs Auth/storage; this is not hosted Supabase acceptance.
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parent.parent
IMAGE = "postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3"
ADMIN = "00000000-0000-0000-0000-000000000001"
DRIVER = "00000000-0000-0000-0000-000000000002"
CONTRACT = "10000000-0000-0000-0000-000000000001"


class AgreementReadConcurrency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = "roadshow-agreement-test-" + uuid.uuid4().hex[:12]
        cls.addClassCleanup(cls.remove_container)
        subprocess.run([
            "docker", "run", "--name", cls.container, "--network", "none",
            "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-d", IMAGE,
        ], check=True, capture_output=True, text=True, timeout=180)
        cls.wait_until(lambda: subprocess.run([
            "docker", "exec", cls.container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres",
        ], capture_output=True, timeout=5).returncode == 0, "PostgreSQL startup", 30)
        cls.sql("create database baseline;")
        cls.sql((ROOT / "supabase/tests/agreement-fixture.sql").read_text(), "baseline")
        seeded = False
        for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            if migration.name.startswith("20261007") and not seeded:
                cls.sql((ROOT / "supabase/tests/agreement-data.sql").read_text(), "baseline")
                seeded = True
            cls.sql(migration.read_text(), "baseline")
        print(cls.sql("select version();").stdout.strip(), flush=True)

    @classmethod
    def remove_container(cls):
        subprocess.run(["docker", "rm", "-f", "-v", cls.container],
                       capture_output=True, timeout=30)

    @classmethod
    def command(cls, database):
        return ["docker", "exec", "-i", cls.container, "psql", "-X", "-qAt",
                "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database]

    @classmethod
    def sql(cls, statement, database="postgres", actor=None, check=True):
        if actor:
            statement = (
                "begin; set local statement_timeout='15s'; set local role authenticated; "
                f"select set_config('request.jwt.claim.sub','{actor}',true); "
                f"{statement}; commit;"
            )
        result = subprocess.run(cls.command(database), input=statement, text=True,
                                capture_output=True, timeout=25)
        if check and result.returncode:
            raise AssertionError(result.stderr)
        return result

    @classmethod
    def scalar(cls, statement, database, actor=None):
        return cls.sql(statement, database, actor).stdout.strip().splitlines()[-1]

    @staticmethod
    def wait_until(predicate, description, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(0.05)
        raise AssertionError("Timed out waiting for " + description)

    def setUp(self):
        self.database = "case_" + uuid.uuid4().hex[:12]
        self.sql(f"create database {self.database} template baseline;")

    def evidence_state(self):
        return json.loads(self.scalar(f"""
            select jsonb_build_object(
              'versions',(select count(*) from public.agreement_versions where contract_id='{CONTRACT}'),
              'periods',(select count(*) from public.agreement_assignment_periods where contract_id='{CONTRACT}'),
              'signatures',(select count(*) from public.agreement_signatures),
              'current_version',(select current_agreement_id from public.contracts where id='{CONTRACT}')
            );
        """, self.database))

    def queued_read(self, issued, lock_kind="advisory", deactivate=True):
        review_sql = f"select public.get_contract_agreement('{CONTRACT}')"
        original = None
        if issued:
            original = json.loads(self.scalar(review_sql, self.database, DRIVER))
        before = self.evidence_state()
        lock_sql = ("select pg_advisory_xact_lock(61007,1)" if lock_kind == "advisory"
                    else f"select id from public.contracts where id='{CONTRACT}' for update")
        revoke_sql = (f"select public.admin_update_user('{DRIVER}','driver',false);"
                      if deactivate else "")
        holder = subprocess.Popen(self.command(self.database), stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            holder.stdin.write(
                "begin; set local statement_timeout='15s'; set local role authenticated; "
                f"select set_config('request.jwt.claim.sub','{ADMIN}',true); {lock_sql}; "
                f"{revoke_sql} select set_config('application_name','race-holder-ready',true);\n"
            )
            holder.stdin.flush()
            self.wait_until(lambda: self.scalar("""
                select count(*) from pg_stat_activity
                where application_name='race-holder-ready' and state='idle in transaction';
            """, self.database) == "1", "holder transaction ready")
            holder_pid = int(self.scalar("""
                select pid from pg_stat_activity where application_name='race-holder-ready';
            """, self.database))
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pending = pool.submit(
                    self.sql, "set local application_name='race-waiter'; " + review_sql,
                    self.database, DRIVER, False,
                )
                try:
                    self.wait_until(lambda: self.scalar(f"""
                        select count(*) from pg_stat_activity where application_name='race-waiter'
                        and wait_event_type='Lock' and {holder_pid}=any(pg_blocking_pids(pid));
                    """, self.database) == "1", "independent reader blocked by holder")
                finally:
                    # Release locks even when the wait assertion fails.
                    holder_out, holder_error = holder.communicate("commit;\n\\q\n", timeout=20)
                self.assertEqual(holder.returncode, 0, holder_error or holder_out)
                result = pending.result(timeout=25)
        finally:
            if holder.poll() is None:
                holder.communicate("rollback;\n\\q\n", timeout=20)

        if deactivate:
            self.assertEqual(self.scalar(
                f"select is_active from public.profiles where id='{DRIVER}'", self.database), "f")
            # Check side effects even on the original SQL's successful read.
            after = self.evidence_state()
            with self.subTest(boundary="no agreement evidence created after revocation"):
                self.assertEqual(after, before)
            with self.subTest(boundary="queued read denied after committed revocation"):
                self.assertNotEqual(result.returncode, 0, "Inactive queued reader received agreement content")
                self.assertIn("An active account is required", result.stderr)
            subsequent = self.sql(review_sql, self.database, DRIVER, check=False)
            self.assertNotEqual(subsequent.returncode, 0)
            self.assertIn("An active account is required", subsequent.stderr)
        else:
            self.assertEqual(result.returncode, 0, result.stderr)
            current = json.loads(result.stdout.strip().splitlines()[-1])
            self.assertEqual(current["version"]["contract_id"], CONTRACT)
            self.assertEqual(current["signatures"], [])
            if original:
                self.assertEqual(current["version"], original["version"])
            self.assertEqual(self.evidence_state()["versions"], 1)

    def test_existing_agreement_denied_after_advisory_wait(self):
        self.queued_read(issued=True)

    def test_initial_issuance_denied_after_advisory_wait(self):
        self.queued_read(issued=False)

    def test_existing_agreement_denied_after_contract_row_wait(self):
        self.queued_read(issued=True, lock_kind="row")

    def test_initial_issuance_denied_after_contract_row_wait(self):
        self.queued_read(issued=False, lock_kind="row")

    def test_active_driver_can_read_existing_agreement_after_wait(self):
        self.queued_read(issued=True, deactivate=False)

    def test_active_driver_can_issue_initial_agreement_after_wait(self):
        self.queued_read(issued=False, deactivate=False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
