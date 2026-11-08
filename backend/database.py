"""database.py —— SQLite 轻量存取（标准库，无额外依赖）"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mingli.db')


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init():
    with get_conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                datetime TEXT NOT NULL,       -- ISO 格式：YYYY-MM-DDTHH:MM
                gender TEXT NOT NULL DEFAULT '男',
                longitude REAL DEFAULT 120,
                note TEXT DEFAULT ''
            )
            """
        )


def list_profiles():
    with get_conn() as c:
        return [dict(r) for r in c.execute('SELECT * FROM profiles ORDER BY id DESC')]


def get_profile(pid):
    with get_conn() as c:
        r = c.execute('SELECT * FROM profiles WHERE id=?', (pid,)).fetchone()
        return dict(r) if r else None


def create_profile(d):
    with get_conn() as c:
        cur = c.execute(
            'INSERT INTO profiles (name, datetime, gender, longitude, note) VALUES (?,?,?,?,?)',
            (d['name'], d['datetime'], d['gender'], d.get('longitude', 120), d.get('note', '')),
        )
        return cur.lastrowid


def update_profile(pid, d):
    with get_conn() as c:
        cur = c.execute(
            'UPDATE profiles SET name=?, datetime=?, gender=?, longitude=?, note=? WHERE id=?',
            (d['name'], d['datetime'], d['gender'], d.get('longitude', 120), d.get('note', ''), pid),
        )
        return cur.rowcount


def delete_profile(pid):
    with get_conn() as c:
        cur = c.execute('DELETE FROM profiles WHERE id=?', (pid,))
        return cur.rowcount


def exists_profile(d):
    """按 name+datetime 判重（导入时避免重复写入）"""
    with get_conn() as c:
        r = c.execute('SELECT 1 FROM profiles WHERE name=? AND datetime=?', (d['name'], d['datetime'])).fetchone()
        return r is not None


def import_profile(d):
    if exists_profile(d):
        return False
    with get_conn() as c:
        c.execute(
            'INSERT INTO profiles (name, datetime, gender, longitude, note) VALUES (?,?,?,?,?)',
            (d['name'], d['datetime'], d['gender'], d.get('longitude', 120), d.get('note', '')),
        )
    return True
