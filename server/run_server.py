from flask import Flask, jsonify
from flask_cors import CORS
import os
import json
import time
import uuid

# 创建应用
app = Flask(__name__)
CORS(app, supports_credentials=True)

# 数据文件路径
DATA_DIR = 'data'
MAPPINGS_FILE = os.path.join(DATA_DIR, 'mappings.json')
SESSIONS_FILE = os.path.join(DATA_DIR, 'sessions.json')
PLAYLISTS_FILE = os.path.join(DATA_DIR, 'playlists.json')

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)

# 工具函数
def load_data(file_path, default=None):
    """从JSON文件加载数据，如果文件不存在返回默认值"""
    if default is None:
        default = {}
        
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return default
    except Exception as e:
        print(f"加载数据错误: {e}")
        return default

def save_data(file_path, data):
    """保存数据到文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存数据错误: {e}")
        return False

# 初始化示例数据
if not os.path.exists(MAPPINGS_FILE):
    # 创建一些示例映射
    example_mappings = [
        {
            "id": str(uuid.uuid4()),
            "bvid": "BV1xx411c001",
            "songName": "示例歌曲1",
            "artist": "示例艺术家1",
            "cover": "https://placehold.co/300x300?text=歌曲1",
            "neteasecloudId": "1000001",
            "uploader_uid": "10000001",
            "play_count": 100,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")
        },
        {
            "id": str(uuid.uuid4()),
            "bvid": "BV1xx411c002",
            "songName": "示例歌曲2",
            "artist": "示例艺术家2",
            "cover": "https://placehold.co/300x300?text=歌曲2",
            "neteasecloudId": "1000002",
            "uploader_uid": "10000001",
            "play_count": 50,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")
        }
    ]
    save_data(MAPPINGS_FILE, example_mappings)

# 健康检查端点
@app.route('/v1/health', methods=['GET'])
def health_check():
    return jsonify({
        "success": True,
        "message": "服务正常运行",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z")
    })

# 获取映射列表端点
@app.route('/v1/mappings', methods=['GET'])
def get_mappings():
    # 加载所有映射
    mappings = load_data(MAPPINGS_FILE, default=[])
    
    # 简单地返回所有映射（实际项目中应添加过滤、分页等）
    return jsonify({
        "success": True,
        "data": {
            "mappings": mappings,
            "total": len(mappings),
            "page": 1,
            "limit": len(mappings)
        }
    })

# 主函数
if __name__ == '__main__':
    print("NB-Music API服务器启动...")
    print(f"访问 http://127.0.0.1:5000/v1/health 检查服务状态")
    app.run(host='127.0.0.1', port=5000, debug=True)
