"""JWT 鉴权:令牌签发/校验、密码哈希、require_login/require_admin 装饰器。"""
import functools
import os
import time

import jwt
from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

_ACCESS_EXPIRE_DEFAULT = 2  # 小时
_REFRESH_EXPIRE_DEFAULT = 30  # 天


def _secret() -> str:
    secret = os.getenv("SHIKE_JWT_SECRET", "")
    if not secret:
        raise ValueError("未配置 SHIKE_JWT_SECRET,无法签发/校验令牌;请在 .env 中生成(openssl rand -hex 32)")
    return secret


def _expire_seconds(token_type: str) -> int:
    if token_type == "refresh":
        days = int(os.getenv("SHIKE_JWT_REFRESH_EXPIRE_DAYS", _REFRESH_EXPIRE_DEFAULT))
        return days * 86400
    hours = int(os.getenv("SHIKE_JWT_ACCESS_EXPIRE_HOURS", _ACCESS_EXPIRE_DEFAULT))
    return hours * 3600


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def create_token(user_id: int, role: str, token_type: str = "access") -> str:
    """签发 JWT;access 携带 role,refresh 不带(type 字段隔离两类令牌防混用)。sub 按 RFC 7519 用字符串。"""
    now = int(time.time())
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + _expire_seconds(token_type)}
    if token_type == "access":
        payload["role"] = role
    return jwt.encode(payload, _secret(), algorithm="HS256")


def issue_token_pair(user: dict) -> dict:
    """签发 (access, refresh) 令牌对。"""
    return {
        "token": create_token(user["id"], user["role"], "access"),
        "refresh_token": create_token(user["id"], user["role"], "refresh"),
    }


def decode_token(token: str, expected_type: str) -> dict | None:
    """解码并校验签名与令牌类型;无效/过期/类型不符/sub 非法返回 None。"""
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    try:
        payload["sub"] = int(payload["sub"])
    except (TypeError, ValueError):
        return None
    return payload


def bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip() or None
    return None


def require_login(view):
    """校验 Bearer access 令牌,查库确认用户存在且未禁用后注入 g.current_user。"""
    from shike import repository

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        token = bearer_token()
        payload = decode_token(token, "access") if token else None
        if payload is None:
            return jsonify({"error": "未登录或令牌无效"}), 401
        user = repository.find_user_by_id(payload["sub"])
        if user is None or user.get("status") != "正常":
            return jsonify({"error": "用户不存在或已禁用"}), 401
        g.current_user = user
        return view(*args, **kwargs)

    return wrapper


def require_admin(view):
    """管理员专用:内含 require_login,叠加角色校验;本期无使用者,预留。"""

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        user = getattr(g, "current_user", None)
        if user is None or user.get("role") != "admin":
            return jsonify({"error": "需要管理员权限"}), 403
        return view(*args, **kwargs)

    return require_login(wrapper)


def optional_login(view):
    """可选登录:带有效 access 令牌则注入 g.current_user,否则按匿名放行(公开读接口判定私有内容可见性用)。"""
    from shike import repository

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        token = bearer_token()
        payload = decode_token(token, "access") if token else None
        user = repository.find_user_by_id(payload["sub"]) if payload else None
        if user is not None and user.get("status") == "正常":
            g.current_user = user
        return view(*args, **kwargs)

    return wrapper


def current_user() -> dict | None:
    """取当前登录用户;未登录(或未经装饰器的路径)返回 None。"""
    return getattr(g, "current_user", None)
