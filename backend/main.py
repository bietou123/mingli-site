"""main.py —— 玄机阁后端：静态托管 + 命主档案 REST API（SQLite）"""
import datetime
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import database

FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend'))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    database.init()
    yield


app = FastAPI(title='玄机阁 API', version='1.0.0', lifespan=lifespan)


# ── 数据模型 ──
class ProfileIn(BaseModel):
    name: str
    datetime: str
    gender: str = '男'
    longitude: float = 120.0
    note: str = ''


class ProfileOut(ProfileIn):
    id: int


def _validate(d: ProfileIn) -> dict:
    if not d.name.strip():
        raise HTTPException(status_code=422, detail='姓名不能为空')
    if d.gender not in ('男', '女'):
        raise HTTPException(status_code=422, detail='性别须为 男/女')
    if not (73.5 <= d.longitude <= 135):
        raise HTTPException(status_code=422, detail='经度须在 73.5~135（东经）')
    return d.model_dump()


# ── 档案 API ──
@app.get('/api/profiles', response_model=list[ProfileOut])
def profiles_list():
    return database.list_profiles()


@app.get('/api/profiles/{pid}', response_model=ProfileOut)
def profiles_get(pid: int):
    p = database.get_profile(pid)
    if not p:
        raise HTTPException(status_code=404, detail='档案不存在')
    return p


@app.post('/api/profiles', response_model=ProfileOut, status_code=201)
def profiles_create(body: ProfileIn):
    data = _validate(body)
    pid = database.create_profile(data)
    return database.get_profile(pid)


@app.put('/api/profiles/{pid}', response_model=ProfileOut)
def profiles_update(pid: int, body: ProfileIn):
    data = _validate(body)
    if not database.update_profile(pid, data):
        raise HTTPException(status_code=404, detail='档案不存在')
    return database.get_profile(pid)


@app.delete('/api/profiles/{pid}', status_code=204)
def profiles_delete(pid: int):
    if not database.delete_profile(pid):
        raise HTTPException(status_code=404, detail='档案不存在')


# ── 备份导出 / 导入 ──
@app.get('/api/export')
def export_profiles():
    return {
        'app': 'mingli-site',
        'kind': 'profile-backup',
        'version': '1.0.0',
        'exportedAt': datetime.datetime.now().isoformat(timespec='seconds'),
        'profiles': database.list_profiles(),
    }


class ImportIn(BaseModel):
    profiles: list[ProfileIn]


@app.post('/api/import')
def import_profiles(body: ImportIn):
    added = skipped = 0
    for p in body.profiles:
        try:
            data = _validate(p)
        except HTTPException:
            skipped += 1
            continue
        if database.import_profile(data):
            added += 1
        else:
            skipped += 1
    return {'added': added, 'skipped': skipped}


@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'mingli-site'}


# ── 静态托管（放在 API 路由之后，路由优先于 mount） ──
@app.get('/')
def index():
    return FileResponse(os.path.join(FRONTEND_DIR, 'index.html'))


app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='static')
