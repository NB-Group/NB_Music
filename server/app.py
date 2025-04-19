from flask import Flask
from flask_cors import CORS
from routes.auth_routes import auth_bp
from routes.mapping_routes import mapping_bp
from routes.playlist_routes import playlist_bp
from routes.play_routes import play_bp

app = Flask(__name__)
CORS(app, supports_credentials=True)

# 注册蓝图
app.register_blueprint(auth_bp, url_prefix='/v1/auth')
app.register_blueprint(mapping_bp, url_prefix='/v1/mappings')
app.register_blueprint(playlist_bp, url_prefix='/v1/playlists')
app.register_blueprint(play_bp, url_prefix='/v1/play')

@app.route('/v1/health', methods=['GET'])
def health_check():
    return {
        "success": True,
        "message": "Service is running"
    }

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
