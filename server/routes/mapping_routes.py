import time
import uuid
from flask import Blueprint, request, jsonify
from utils.auth import authenticate
from utils.file_storage import save_data, load_data

mapping_bp = Blueprint('mappings', __name__)

# 映射数据存储文件
MAPPINGS_FILE = 'data/mappings.json'

@mapping_bp.route('', methods=['GET'])
def get_mappings():
    # 获取查询参数
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    sort = request.args.get('sort', 'newest')
    search = request.args.get('search', None)
    bvid = request.args.get('bvid', None)
    
    # 加载全部映射
    mappings = load_data(MAPPINGS_FILE, default=[])
    
    # 过滤
    if bvid:
        filtered = [m for m in mappings if m.get('bvid') == bvid]
    elif search:
        search = search.lower()
        filtered = [
            m for m in mappings 
            if search in m.get('songName', '').lower() or 
               search in m.get('artist', '').lower()
        ]
    else:
        filtered = mappings
    
    # 排序
    if sort == 'newest':
        filtered.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    elif sort == 'popular':
        filtered.sort(key=lambda x: x.get('play_count', 0), reverse=True)
    
    # 计算分页
    total = len(filtered)
    start = (page - 1) * limit
    end = start + limit
    result = filtered[start:end]
    
    return jsonify({
        "success": True,
        "data": {
            "mappings": result,
            "total": total,
            "page": page,
            "limit": limit
        }
    })

@mapping_bp.route('', methods=['POST'])
@authenticate
def create_mapping(user):
    try:
        data = request.json
        
        # 验证必要字段
        required_fields = ['bvid', 'songName', 'artist', 'neteasecloudId']
        if not data or not all(field in data for field in required_fields):
            return jsonify({
                "success": False,
                "error": {"code": 400, "message": "缺少必要字段"}
            }), 400
        
        # 检查是否已存在同BV号的映射
        mappings = load_data(MAPPINGS_FILE, default=[])
        if any(m.get('bvid') == data['bvid'] for m in mappings):
            return jsonify({
                "success": False,
                "error": {"code": 409, "message": "该B站视频已有映射"}
            }), 409
            
        # 创建映射
        mapping_id = str(uuid.uuid4())
        now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        
        # 构造新映射
        new_mapping = {
            'id': mapping_id,
            'bvid': data['bvid'],
            'songName': data['songName'],
            'artist': data['artist'],
            'cover': data.get('cover', ''),
            'neteasecloudId': data['neteasecloudId'],
            'uploader_uid': user['uid'],
            'play_count': 0,
            'created_at': now,
            'is_public': data.get('is_public', True)
        }
        
        # 保存
        mappings.append(new_mapping)
        save_data(MAPPINGS_FILE, mappings)
        
        return jsonify({
            "success": True,
            "data": {
                "id": mapping_id,
                "created_at": now
            }
        })
        
    except Exception as e:
        print(f"Create mapping error: {str(e)}")
        return jsonify({
            "success": False,
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500

@mapping_bp.route('/<mapping_id>', methods=['DELETE'])
@authenticate
def delete_mapping(user, mapping_id):
    try:
        # 加载映射
        mappings = load_data(MAPPINGS_FILE, default=[])
        
        # 查找映射
        mapping_index = next((i for i, m in enumerate(mappings) 
                             if m.get('id') == mapping_id), None)
        
        if mapping_index is None:
            return jsonify({
                "success": False,
                "error": {"code": 404, "message": "映射不存在"}
            }), 404
            
        # 检查权限
        if mappings[mapping_index].get('uploader_uid') != user['uid']:
            return jsonify({
                "success": False,
                "error": {"code": 403, "message": "无权删除此映射"}
            }), 403
            
        # 删除映射
        deleted = mappings.pop(mapping_index)
        save_data(MAPPINGS_FILE, mappings)
        
        return jsonify({
            "success": True,
            "data": {
                "deleted_id": mapping_id
            }
        })
        
    except Exception as e:
        print(f"Delete mapping error: {str(e)}")
        return jsonify({
            "success": False, 
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500
