import time
from flask import Blueprint, request, jsonify
from utils.auth import authenticate
from utils.file_storage import save_data, load_data

play_bp = Blueprint('play', __name__)

# 播放记录数据存储文件
PLAY_RECORDS_FILE = 'data/play_records.json'
MAPPINGS_FILE = 'data/mappings.json'

@play_bp.route('/record', methods=['POST'])
@authenticate
def record_play(user):
    try:
        data = request.json
        
        # 验证必要字段
        if not data or 'bvid' not in data or 'duration' not in data:
            return jsonify({
                "success": False,
                "error": {"code": 400, "message": "缺少必要字段"}
            }), 400
            
        bvid = data['bvid']
        duration = data['duration']
        song_id = data.get('song_id')
        playlist_id = data.get('playlist_id')
        
        # 记录播放
        play_records = load_data(PLAY_RECORDS_FILE, default=[])
        now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        
        play_record = {
            'user_id': user['uid'],
            'bvid': bvid,
            'duration': duration,
            'timestamp': now
        }
        
        if song_id:
            play_record['song_id'] = song_id
        if playlist_id:
            play_record['playlist_id'] = playlist_id
            
        play_records.append(play_record)
        save_data(PLAY_RECORDS_FILE, play_records)
        
        # 更新映射的播放次数
        mappings = load_data(MAPPINGS_FILE, default=[])
        mapping_index = next((i for i, m in enumerate(mappings) 
                             if m.get('bvid') == bvid), None)
                             
        if mapping_index is not None:
            mappings[mapping_index]['play_count'] = mappings[mapping_index].get('play_count', 0) + 1
            save_data(MAPPINGS_FILE, mappings)
        
        return jsonify({
            "success": True,
            "data": {
                "recorded": True
            }
        })
        
    except Exception as e:
        print(f"Record play error: {str(e)}")
        return jsonify({
            "success": False,
            "error": {"code": 500, "message": f"服务器错误: {str(e)}"}
        }), 500
