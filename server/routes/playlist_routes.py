import time
import uuid
from flask import Blueprint, request, jsonify
from utils.auth import authenticate
from utils.file_storage import save_data, load_data

playlist_bp = Blueprint('playlists', __name__)

# 歌单数据存储文件
PLAYLISTS_FILE = 'data/playlists.json'

@playlist_bp.route('', methods=['GET'])
@authenticate
def get_playlists(user):
    try:
        include_songs = request.args.get('include_songs', 'false').lower() == 'true'
        
        # 加载用户的歌单
        all_playlists = load_data(PLAYLISTS_FILE, default=[])
        user_playlists = [pl for pl in all_playlists if pl.get('user_id') == user['uid']]
        
        # 如果不需要包含歌曲，则移除songs字段
        if not include_songs:
            for playlist in user_playlists:
                if 'songs' in playlist:
                    del playlist['songs']
        
        return jsonify({
            "success": True,
            "data": {
                "playlists": user_playlists
            }
        })
        
    except Exception as e:
        print(f"Get playlists error: {str(e)}")
        return jsonify({
            "success": False,
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500

@playlist_bp.route('', methods=['POST'])
@authenticate
def create_playlist(user):
    try:
        data = request.json
        
        # 验证必要字段
        if not data or 'name' not in data:
            return jsonify({
                "success": False,
                "error": {"code": 400, "message": "缺少必要字段"}
            }), 400
        
        # 创建歌单
        playlist_id = str(uuid.uuid4())
        now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        
        # 构造新歌单
        new_playlist = {
            'id': playlist_id,
            'name': data['name'],
            'description': data.get('description', ''),
            'cover': data.get('cover', ''),
            'songs': data.get('songs', []),
            'song_count': len(data.get('songs', [])),
            'user_id': user['uid'],
            'created_at': now,
            'updated_at': now
        }
        
        # 保存
        playlists = load_data(PLAYLISTS_FILE, default=[])
        playlists.append(new_playlist)
        save_data(PLAYLISTS_FILE, playlists)
        
        return jsonify({
            "success": True,
            "data": {
                "id": playlist_id,
                "created_at": now
            }
        })
        
    except Exception as e:
        print(f"Create playlist error: {str(e)}")
        return jsonify({
            "success": False,
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500

@playlist_bp.route('/<playlist_id>/songs', methods=['PUT'])
@authenticate
def update_playlist_songs(user, playlist_id):
    try:
        data = request.json
        
        # 验证必要字段
        if not data or 'action' not in data or 'songs' not in data:
            return jsonify({
                "success": False,
                "error": {"code": 400, "message": "缺少必要字段"}
            }), 400
            
        action = data['action']
        songs = data['songs']
        
        if action not in ['add', 'remove', 'replace']:
            return jsonify({
                "success": False,
                "error": {"code": 400, "message": "无效的操作类型"}
            }), 400
            
        # 加载歌单
        playlists = load_data(PLAYLISTS_FILE, default=[])
        
        # 查找歌单
        playlist_index = next((i for i, p in enumerate(playlists) 
                              if p.get('id') == playlist_id), None)
        
        if playlist_index is None:
            return jsonify({
                "success": False,
                "error": {"code": 404, "message": "歌单不存在"}
            }), 404
            
        # 检查权限
        if playlists[playlist_index].get('user_id') != user['uid']:
            return jsonify({
                "success": False,
                "error": {"code": 403, "message": "无权修改此歌单"}
            }), 403
            
        playlist = playlists[playlist_index]
        current_songs = playlist.get('songs', [])
        
        # 执行操作
        if action == 'replace':
            playlist['songs'] = songs
            updated_count = len(songs)
        elif action == 'add':
            # 添加不存在的歌曲
            added = 0
            for song in songs:
                if not any(s.get('bvid') == song.get('bvid') for s in current_songs):
                    current_songs.append(song)
                    added += 1
            playlist['songs'] = current_songs
            updated_count = added
        elif action == 'remove':
            # 移除匹配的歌曲
            removed = 0
            bvids_to_remove = [s.get('bvid') for s in songs]
            new_songs = []
            for song in current_songs:
                if song.get('bvid') not in bvids_to_remove:
                    new_songs.append(song)
                else:
                    removed += 1
            playlist['songs'] = new_songs
            updated_count = removed
            
        # 更新歌曲数量和时间戳
        playlist['song_count'] = len(playlist['songs'])
        playlist['updated_at'] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        
        # 保存更改
        playlists[playlist_index] = playlist
        save_data(PLAYLISTS_FILE, playlists)
        
        return jsonify({
            "success": True,
            "data": {
                "updated_count": updated_count
            }
        })
        
    except Exception as e:
        print(f"Update playlist songs error: {str(e)}")
        return jsonify({
            "success": False,
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500
