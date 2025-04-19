import time
import json
import uuid
import requests
from flask import Blueprint, request, jsonify
from utils.auth import generate_session_token, verify_session_token
from utils.file_storage import save_data, load_data

auth_bp = Blueprint('auth', __name__)

# 用户会话存储
SESSIONS_FILE = 'data/sessions.json'

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        # 验证必要字段
        if not data or not all(k in data for k in ('bilibili_uid', 'token', 'timestamp')):
            return jsonify({
                "success": False,
                "error": {"code": 400, "message": "缺少必要参数"}
            }), 400
        
        bilibili_uid = data['bilibili_uid']
        token = data['token']  # 这是加密的SESSDATA
        
        # 向B站API发送请求验证用户
        cookies = {'SESSDATA': token}
        bili_response = requests.get(
            'https://api.bilibili.com/x/web-interface/nav',
            cookies=cookies
        )
        
        bili_data = bili_response.json()
        
        # 验证B站返回的UID是否匹配
        if bili_response.status_code != 200 or bili_data.get('code') != 0:
            return jsonify({
                "success": False,
                "error": {"code": 401, "message": "B站验证失败"}
            }), 401
        
        # 提取B站用户信息
        user_info = bili_data.get('data', {})
        if str(user_info.get('mid', '')) != str(bilibili_uid):
            return jsonify({
                "success": False,
                "error": {"code": 401, "message": "用户ID不匹配"}
            }), 401
            
        # 生成会话令牌
        session_token = generate_session_token(bilibili_uid)
        
        # 保存会话信息
        sessions = load_data(SESSIONS_FILE, default={})
        sessions[session_token] = {
            'uid': bilibili_uid,
            'created_at': time.time(),
            'nickname': user_info.get('uname', ''),
            'avatar': user_info.get('face', '')
        }
        save_data(SESSIONS_FILE, sessions)
        
        return jsonify({
            "success": True,
            "data": {
                "session_token": session_token,
                "user_info": {
                    "uid": bilibili_uid,
                    "nickname": user_info.get('uname', ''),
                    "avatar": user_info.get('face', '')
                }
            }
        })
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            "success": False,
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500
