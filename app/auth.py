"""Accounts: firms, users, cookie sessions. Stdlib crypto only.

Control tables live in the DEFAULT store (db.connect_default) and never in a firm
store. Each firm's data lives in its own store, provisioned here on creation and
selected per request by server middleware via db.firm_scope.
"""
import hashlib
import hmac
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Request

from . import seed, theses
from .memory import db

COOKIE = "fs_session"
SESSION_DAYS = 30


class AuthError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


@dataclass
class Firm:
    slug: str
    name: str
    invite_code: str


@dataclass
class User:
    id: str
    email: str
    firm: Firm


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- passwords / tokens ------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(password.encode(), salt=salt, n=2 ** 14, r=8, p=1)
    return f"scrypt${salt.hex()}${h.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, h_hex = stored.split("$")
        h = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex),
                           n=2 ** 14, r=8, p=1)
        return hmac.compare_digest(h.hex(), h_hex)
    except (ValueError, TypeError):
        return False


def _token_id(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- control store -----------------------------------------------------------

def _control():
    conn = db.connect_default()
    try:
        conn.execute("SELECT 1 FROM firms LIMIT 1").fetchone()
    except Exception:  # first touch of a fresh store (tests use a temp db per test)
        conn.rollback()
        db.init_control(conn)
    return conn


def _firm_row(r) -> Firm:
    return Firm(slug=r["slug"], name=r["name"], invite_code=r["invite_code"])


def _free_slug(conn, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:32] or "firm"
    if not base[0].isalpha():
        base = f"f_{base}"
    slug, n = base, 1
    while True:
        try:
            db.validate_slug(slug)
            taken = conn.execute("SELECT 1 FROM firms WHERE slug=?", (slug,)).fetchone()
        except ValueError:
            taken = True
        if not taken:
            return slug
        n += 1
        slug = f"{base}_{n}"


def provision_firm(slug: str) -> None:
    """Create the firm's store: schema/file + tables, demo snapshot, default thesis."""
    with db.firm_scope(slug):
        conn = db.connect()
        db.init_db(conn)
        seed.seed_firm(conn)
        theses.import_default(conn)
        conn.commit()


def create_firm(name: str) -> Firm:
    name = name.strip()
    if not name:
        raise AuthError(422, "firm name is required")
    conn = _control()
    firm = Firm(slug=_free_slug(conn, name), name=name,
                invite_code=secrets.token_urlsafe(8))
    conn.execute("INSERT INTO firms (slug, name, invite_code, created_at) VALUES (?,?,?,?)",
                 (firm.slug, firm.name, firm.invite_code, _now().isoformat()))
    conn.commit()
    provision_firm(firm.slug)
    return firm


def ensure_demo_firm() -> tuple[Firm, bool]:
    """The pre-existing data is the demo firm; register it once (returns created?)."""
    conn = _control()
    row = conn.execute("SELECT * FROM firms WHERE slug=?", (db.DEMO_FIRM,)).fetchone()
    if row:
        return _firm_row(row), False
    firm = Firm(slug=db.DEMO_FIRM, name="FirstSignal Demo",
                invite_code=secrets.token_urlsafe(8))
    conn.execute("INSERT INTO firms (slug, name, invite_code, created_at) VALUES (?,?,?,?)",
                 (firm.slug, firm.name, firm.invite_code, _now().isoformat()))
    conn.commit()
    return firm, True


def firm_by_invite(code: str) -> Firm:
    row = _control().execute("SELECT * FROM firms WHERE invite_code=?",
                             (code.strip(),)).fetchone()
    if not row:
        raise AuthError(404, "no firm matches that invite code")
    return _firm_row(row)


# --- users / sessions --------------------------------------------------------

def _issue_session(conn, user_id: str, firm_slug: str) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions (id, user_id, firm_slug, expires_at) VALUES (?,?,?,?)",
                 (_token_id(token), user_id, firm_slug,
                  (_now() + timedelta(days=SESSION_DAYS)).isoformat()))
    conn.commit()
    return token


def signup(email: str, password: str, firm_name: str | None = None,
           invite_code: str | None = None) -> tuple[User, str]:
    email = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise AuthError(422, "a valid email is required")
    if len(password) < 8:
        raise AuthError(422, "password must be at least 8 characters")
    conn = _control()
    if conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        raise AuthError(409, "an account with that email already exists — sign in")
    if invite_code:
        firm = firm_by_invite(invite_code)
    elif firm_name:
        firm = create_firm(firm_name)
    else:
        raise AuthError(422, "give a firm name to create a firm, or an invite code to join one")
    uid = str(uuid.uuid4())
    conn.execute("INSERT INTO users (id, email, password_hash, firm_slug, created_at) "
                 "VALUES (?,?,?,?,?)",
                 (uid, email, hash_password(password), firm.slug, _now().isoformat()))
    conn.commit()
    return User(id=uid, email=email, firm=firm), _issue_session(conn, uid, firm.slug)


def login(email: str, password: str) -> tuple[User, str]:
    conn = _control()
    row = conn.execute(
        "SELECT u.id, u.email, u.password_hash, f.slug, f.name, f.invite_code "
        "FROM users u JOIN firms f ON f.slug=u.firm_slug WHERE u.email=?",
        (email.strip().lower(),)).fetchone()
    # Same message for unknown email and wrong password: no account enumeration.
    if not row or not verify_password(password, row["password_hash"]):
        raise AuthError(401, "email or password is incorrect")
    user = User(id=row["id"], email=row["email"], firm=_firm_row(row))
    return user, _issue_session(conn, user.id, user.firm.slug)


GUEST_EMAIL = "guest@demo.firstsignal"


def demo_session() -> tuple[User, str]:
    """A session in the demo firm with no account: one shared guest user whose
    password is random and never disclosed, so it can only be reached this way."""
    firm, _ = ensure_demo_firm()
    conn = _control()
    row = conn.execute("SELECT id FROM users WHERE email=?", (GUEST_EMAIL,)).fetchone()
    if row:
        uid = row["id"]
    else:
        uid = str(uuid.uuid4())
        conn.execute("INSERT INTO users (id, email, password_hash, firm_slug, created_at) "
                     "VALUES (?,?,?,?,?)",
                     (uid, GUEST_EMAIL, hash_password(secrets.token_urlsafe(32)),
                      firm.slug, _now().isoformat()))
        conn.commit()
    return User(id=uid, email=GUEST_EMAIL, firm=firm), _issue_session(conn, uid, firm.slug)


def logout(token: str | None) -> None:
    if token:
        conn = _control()
        conn.execute("DELETE FROM sessions WHERE id=?", (_token_id(token),))
        conn.commit()


def user_for_token(token: str | None) -> User | None:
    if not token:
        return None
    row = _control().execute(
        "SELECT s.expires_at, u.id, u.email, f.slug, f.name, f.invite_code "
        "FROM sessions s JOIN users u ON u.id=s.user_id JOIN firms f ON f.slug=u.firm_slug "
        "WHERE s.id=?", (_token_id(token),)).fetchone()
    if not row or datetime.fromisoformat(row["expires_at"]) < _now():
        return None
    return User(id=row["id"], email=row["email"], firm=_firm_row(row))


def resolve_request(request: Request) -> User | None:
    """The one place a request becomes a user. Tests patch this."""
    return user_for_token(request.cookies.get(COOKIE))


def cookie_kwargs(request: Request) -> dict:
    https = (request.headers.get("x-forwarded-proto", request.url.scheme) == "https")
    return dict(key=COOKIE, httponly=True, samesite="lax", secure=https,
                max_age=SESSION_DAYS * 86400, path="/")
