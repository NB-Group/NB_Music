import os
import json
import time
import threading

# 文件锁，防止并发写入问题
file_locks = {}
lock_for_locks = threading.Lock()

def get_file_lock(filename):
    with lock_for_locks:
        if filename not in file_locks:
            file_locks[filename] = threading.Lock()
        return file_locks[filename]

def save_data(filename, data):
    """将数据保存到JSON文件"""
    # 确保目录存在
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    # 获取文件锁并写入
    with get_file_lock(filename):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def load_data(filename, default=None):
    """从JSON文件加载数据，如果文件不存在则返回默认值"""
    if default is None:
        default = {}
        
    if not os.path.exists(filename):
        return default
    
    with get_file_lock(filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            # 文件损坏或不存在时返回默认值
            return default
