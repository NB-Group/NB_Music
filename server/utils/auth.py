import time
import uuid
import hashlib
import functools
from flask import request, jsonify
from .file_storage import load_data

# 会话令牌过期时间（秒）
TOKEN_EXPIRY = 30 * 24 * 60 * 60  # 30天

def generate_session_token(uid):
    """生成会话令牌"""
    # 使用用户ID、时间戳和随机UUID生成令牌
    timestamp = str(time.time())
    random_str = str(uuid.uuid4())
    
    # 计算哈希
    data = f"{uid}-{timestamp}-{random_str}"
    return hashlib.sha256(data.encode()).hexdigest()

def verify_session_token(token):
    """验证会话令牌是否有效并返回用户信息"""
    sessions = load_data('data/sessions.json', default={})
    
    # 检查令牌是否存在
    if token not in sessions:
        return None
        
    # 检查令牌是否过期
    session = sessions[token]
    if time.time() - session['created_at'] > TOKEN_EXPIRY:
        return None
        
    return session

def authenticate(f):
    """认证装饰器"""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        # 从请求头中获取令牌
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "error": {"code": 401, "message": "未提供有效的认证令牌"}
            }), 401
            
        token = auth_header[7:]  # 移除"Bearer "前缀
        
        # 验证令牌
        user = verify_session_token(token)
        if not user:
            return jsonify({
                "success": False,
                "error": {"code": 401, "message": "认证令牌无效或已过期"}
            }), 401
            
        # 向视图函数传递用户信息
        return f(user=user, *args, **kwargs)
    
    return decorated
