const QRCode = require("qrcode");
const axios = require("axios");
const { ipcRenderer } = require("electron");
const md5 = require("md5");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const open = require("open");

class LoginManager {
    /**
     * 登录管理组件
     * @param {import("./UIManager.js")} uiManager
     */
    constructor(uiManager) {
        this.qrcodeKey = null;
        this.pollTimer = null;
        this.loginDialog = document.getElementById('loginDialog');
        this.qrcodeCanvas = document.getElementById('qrcode');
        this.qrcodeStatus = document.getElementById('qrcodeStatus');
        this.loginBtn = document.querySelector('.login-btn');
        this.refreshBtn = document.getElementById('refreshQRCode');
        this.cancelBtn = document.getElementById('cancelLogin');
        this.uiManager = uiManager;

        this.isLogin = false;
        this.showAccountOptions = false;
        this.cookie = "";
        this.userMid = "";

        ipcRenderer.send("get-cookies");
        ipcRenderer.once("get-cookies-success", (event, cookie) => {
            this.cookie = cookie;
        });

        this.bindEvents();
        this.updateLoginStatus();

        // 初始化自动刷新cookie功能
        this.initAutoCookieRefresh();
    }

    async updateLoginStatus() {
        try {
            const response = await axios.get("https://api.bilibili.com/x/web-interface/nav");

            if (response.data.code === 0) {
                this.isLogin = true;
                const userData = response.data.data;
                const username = userData.uname;

                // 赋值用户MID以便于其他地方使用
                this.userMid = userData.mid;

                document.getElementById("account-home").addEventListener("click", () => open("https://space.bilibili.com/" + this.userMid));

                if (this.loginBtn) {
                    // 先更新文本
                    this.loginBtn.innerHTML = `<img class="user-avatar" alt="用户头像" /> <span>${username}</span>`;

                    // 异步获取并添加用户头像
                    if (this.userMid) {
                        this.getUserAvatar(this.userMid)
                            .then((avatar) => {
                                const avatarImg = this.loginBtn.querySelector(".user-avatar");
                                if (avatarImg) {
                                    avatarImg.src = avatar;
                                }
                            })
                            .catch((err) => {
                                console.error("获取头像失败:", err);
                            });
                    }
                }
            }
        } catch (error) {
            console.error("获取登录状态失败:", error);
        }
    }

    // 获取用户头像
    async getUserAvatar(mid) {
        try {
            // 获取WBI签名所需的keys
            const { img_key, sub_key } = await this.getWbiKeys();

            // 准备参数并生成签名
            const params = { mid };
            const query = this.encWbi(params, img_key, sub_key);

            // 调用API获取用户信息
            const response = await axios.get(`https://api.bilibili.com/x/space/wbi/acc/info?${query}`);

            if (response.data.code === 0) {
                return response.data.data.face;
            }
            throw new Error(response.data.message || "获取头像失败");
        } catch (error) {
            console.error("获取用户头像失败:", error);
            return ""; // 返回空字符串，UI可以显示默认头像或不显示
        }
    }

    // 获取WBI密钥
    async getWbiKeys() {
        try {
            const response = await axios.get("https://api.bilibili.com/x/web-interface/nav");
            const { wbi_img } = response.data.data;

            if (!wbi_img) {
                throw new Error("无法获取WBI密钥");
            }

            const { img_url, sub_url } = wbi_img;

            return {
                img_key: img_url.slice(img_url.lastIndexOf("/") + 1, img_url.lastIndexOf(".")),
                sub_key: sub_url.slice(sub_url.lastIndexOf("/") + 1, sub_url.lastIndexOf("."))
            };
        } catch (error) {
            console.error("获取WBI密钥失败:", error);
            throw error;
        }
    }

    // 生成WBI签名
    encWbi(params, imgKey, subKey) {
        // 混合密钥表
        const mixinKeyEncTab = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];

        // 获取混合密钥
        const getMixinKey = (orig) => {
            return mixinKeyEncTab
                .map((n) => orig[n])
                .join("")
                .slice(0, 32);
        };

        const mixinKey = getMixinKey(imgKey + subKey);
        const currTime = Math.round(Date.now() / 1000);
        const chrFilter = /[!'()*]/g;

        // 添加时间戳
        params.wts = currTime;

        // 构建查询字符串
        const query = Object.keys(params)
            .sort()
            .map((key) => {
                const value = params[key].toString().replace(chrFilter, "");
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .join("&");

        // 生成签名
        const wbiSign = md5(query + mixinKey);
        return `${query}&w_rid=${wbiSign}`;
    }

    bindEvents() {
        const loginBtn = document.querySelector(".login-btn");
        // const loginDialog = document.getElementById("loginDialog");
        const refreshBtn = document.getElementById("refreshQRCode");
        const reOpenBrowserBtn = document.getElementById("reOpenBrowser");
        const cancelBtn = document.getElementById("cancelLogin");
        const canelBtn2 = document.getElementById("cancelLogin2");
        const switchBrowser = document.getElementById("switchBrowser");
        const switchQrcode = document.getElementById("switchQrcode");
        const logoutBtn = document.getElementById("account-logout");

        loginBtn.addEventListener("click", () => this.showLoginDialog());
        refreshBtn.addEventListener("click", () => this.generateQRCode());
        reOpenBrowserBtn.addEventListener("click", () => this.browserLogin());
        cancelBtn.addEventListener("click", () => this.hideLoginDialog());
        canelBtn2.addEventListener("click", () => this.hideLoginDialog());
        switchBrowser.addEventListener("click", () => this.switchLoginMethod("browser"));
        switchQrcode.addEventListener("click", () => this.switchLoginMethod("qrcode"));
        logoutBtn.addEventListener("click", () => this.logout());

        // 判断系统是否为Windows
        if (process.platform === "win32") {
            switchBrowser.classList.remove("hide");
        }

        document.addEventListener("click", () => {
            const optionsContainer = document.querySelector(".account-options-container");
            if (optionsContainer.classList.contains("show")) {
                if (this.showAccountOptions) {
                    this.showAccountOptions = false;
                    optionsContainer.classList.remove("show");
                } else {
                    this.showAccountOptions = true;
                }
            }
        });
    }

    async generateQRCode() {
        try {
            const response = await fetch("https://passport.bilibili.com/x/passport-login/web/qrcode/generate");
            const data = await response.json();

            if (data.code === 0) {
                this.qrcodeKey = data.data.qrcode_key;
                // 清空已有内容
                const context = this.qrcodeCanvas.getContext("2d");
                context.clearRect(0, 0, this.qrcodeCanvas.width, this.qrcodeCanvas.height);

                // 设置canvas大小
                this.qrcodeCanvas.width = 200;
                this.qrcodeCanvas.height = 200;

                // 生成二维码
                await QRCode.toCanvas(this.qrcodeCanvas, data.data.url, {
                    width: 200,
                    margin: 2,
                    color: {
                        dark: "#000000",
                        light: "#ffffff"
                    }
                });

                this.qrcodeStatus.textContent = "请使用哔哩哔哩客户端扫码登录";
                this.startPolling();
            }
        } catch (error) {
            console.error("生成二维码失败:", error);
            this.qrcodeStatus.textContent = "生成二维码失败，请重试";
        }
    }

    async pollLoginStatus() {
        try {
            const response = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${this.qrcodeKey}`);
            const data = await response.json();

            if (data.code === 0) {
                switch (data.data.code) {
                    case 0: {
                        // 登录成功
                        this.qrcodeStatus.textContent = '登录成功，正在设置...';
                        this.clearPolling();

                        // 获取所有的cookie
                        const rawCookies = data.data.url.match(/[^?]*\?(.*)/)[1].split("&");
                        const cookies = rawCookies.map((pair) => {
                            const [name, value] = pair.split("=");
                            return `${name}=${value}`;
                        });

                        // 发送给主进程设置
                        ipcRenderer.send("login-success", { cookies });

                        ipcRenderer.once('cookies-set-error', (_, error) => {
                            this.uiManager.showNotification('登录失败', 'error');
                            this.qrcodeStatus.textContent = `登录失败: ${error}`;
                            console.error('登录失败:', error);

                            setTimeout(() => this.hideLoginDialog(), 2000);
                        });
                        break;
                    }

                    case 86038: // 二维码已过期
                        this.qrcodeStatus.textContent = '二维码已过期，请点击刷新';
                        this.clearPolling();
                        break;

                    case 86101: // 等待扫码
                        this.qrcodeStatus.textContent = '请使用哔哩哔哩客户端扫码登录';
                        break;

                    case 86090: // 已扫码等待确认
                        this.qrcodeStatus.textContent = '请在手机上确认登录';
                        break;
                }
            }
        } catch (error) {
            console.error("检查登录状态失败:", error);
            this.clearPolling();
        }
    }

    startPolling() {
        this.clearPolling();
        this.pollTimer = setInterval(() => this.pollLoginStatus(), 1500);
    }

    clearPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    showLoginDialog() {
        if (this.isLogin) {
            document.querySelector(".account-options-container").classList.add("show");
        } else {
            ipcRenderer.once("cookies-set", () => {
                this.hideLoginDialog();
                location.reload(); // 刷新页面应用新cookie
            });

            document.getElementById("loginDialog").classList.remove("hide");
            this.generateQRCode();
        }
    }

    hideLoginDialog() {
        document.getElementById("loginDialog").classList.add("hide");

        ipcRenderer.send("close-browser-auth-server");
        document.getElementById("browserLogin").classList.add("hide");
        document.getElementById("qrcodeLogin").classList.remove("hide");
    }

    // 初始化自动刷新cookie
    initAutoCookieRefresh() {
        // 检查localStorage中是否有refresh_token
        const refreshToken = localStorage.getItem("ac_time_value");

        if (refreshToken) {
            // 检查是否需要刷新cookie（每天第一次访问时）
            const lastCheckDate = localStorage.getItem("last_cookie_check_date");
            const today = new Date().toDateString();

            if (lastCheckDate !== today) {
                // 记录今天已经检查过
                localStorage.setItem("last_cookie_check_date", today);
                // 检查并刷新cookie
                this.checkAndRefreshCookie(refreshToken);
            }
        }
    }

    // 检查是否需要刷新cookie
    async checkAndRefreshCookie(refreshToken) {
        try {
            console.log("检查是否需要刷新cookie...");
            const response = await axios.get("https://passport.bilibili.com/x/passport-login/web/cookie/info");

            if (response.data.code === 0) {
                const { refresh, timestamp } = response.data.data;

                if (refresh) {
                    console.log("需要刷新cookie");
                    // 生成CorrespondPath
                    const correspondPath = await this.generateCorrespondPath(timestamp);
                    // 获取refresh_csrf
                    const refreshCsrf = await this.getRefreshCsrf(correspondPath);

                    if (refreshCsrf) {
                        // 保存旧的refresh_token备用
                        const oldRefreshToken = refreshToken;
                        // 刷新Cookie
                        const result = await this.refreshCookie(refreshCsrf, oldRefreshToken);

                        if (result.success) {
                            // 确认更新
                            await this.confirmRefresh(oldRefreshToken, result.newCsrf);
                            console.log("Cookie刷新成功");
                        }
                    }
                } else {
                    console.log("不需要刷新cookie");
                }
            }
        } catch (error) {
            console.error("检查刷新cookie失败:", error);
        }
    }

    // 生成CorrespondPath
    async generateCorrespondPath(timestamp) {
        try {
            // 使用JavaScript内置的SubtleCrypto API进行RSA-OAEP加密
            const publicKey = await window.crypto.subtle.importKey(
                "jwk",
                {
                    kty: "RSA",
                    n: "y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE",
                    e: "AQAB"
                },
                { name: "RSA-OAEP", hash: "SHA-256" },
                true,
                ["encrypt"]
            );

            const data = new TextEncoder().encode(`refresh_${timestamp}`);
            const encrypted = new Uint8Array(await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, data));

            return encrypted.reduce((str, c) => str + c.toString(16).padStart(2, "0"), "");
        } catch (error) {
            console.error("生成CorrespondPath失败:", error);
            return null;
        }
    }

    // 获取refresh_csrf
    async getRefreshCsrf(correspondPath) {
        try {
            const response = await axios.get(`https://www.bilibili.com/correspond/1/${correspondPath}`);

            // 从HTML响应中解析refresh_csrf
            const htmlContent = response.data;
            const match = htmlContent.match(/<div id="1-name">(.*?)<\/div>/);

            if (match && match[1]) {
                return match[1];
            }
            throw new Error("获取refresh_csrf失败");
        } catch (error) {
            console.error("获取refresh_csrf失败:", error);
            return null;
        }
    }

    // 刷新Cookie
    async refreshCookie(refreshCsrf, refreshToken) {
        try {
            // 获取当前的CSRF Token
            const biliJct = this.getCookie("bili_jct");

            if (!biliJct) {
                throw new Error("获取bili_jct失败");
            }

            // 构建请求参数
            const params = new URLSearchParams();
            params.append("csrf", biliJct);
            params.append("refresh_csrf", refreshCsrf);
            params.append("source", "main_web");
            params.append("refresh_token", refreshToken);

            // 发送请求
            const response = await axios.post("https://passport.bilibili.com/x/passport-login/web/cookie/refresh", params, { withCredentials: true });

            if (response.data.code === 0) {
                // 保存新的refresh_token
                const newRefreshToken = response.data.data.refresh_token;
                localStorage.setItem("ac_time_value", newRefreshToken);

                // 获取新的CSRF Token（从cookie中获取）
                const newCsrf = this.getCookie("bili_jct");

                return {
                    success: true,
                    newRefreshToken,
                    newCsrf
                };
            }

            throw new Error(response.data.message || "刷新Cookie失败");
        } catch (error) {
            console.error("刷新Cookie失败:", error);
            return { success: false };
        }
    }

    // 确认更新
    async confirmRefresh(oldRefreshToken, newCsrf) {
        try {
            // 构建请求参数
            const params = new URLSearchParams();
            params.append("csrf", newCsrf);
            params.append("refresh_token", oldRefreshToken);

            // 发送请求
            const response = await axios.post("https://passport.bilibili.com/x/passport-login/web/confirm/refresh", params, { withCredentials: true });

            if (response.data.code === 0) {
                return true;
            }

            throw new Error(response.data.message || "确认更新失败");
        } catch (error) {
            console.error("确认更新失败:", error);
            return false;
        }
    }

    // 获取cookie值的辅助方法
    getCookie(name) {
        const value = `;${this.cookie}`;
        const parts = value.split(`;${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
        return null;
    }

    // 切换登录方式
    switchLoginMethod(option) {
        if (option === "browser") {
            this.clearPolling();
            document.getElementById("qrcodeLogin").classList.add("hide");
            document.getElementById("browserLogin").classList.remove("hide");

            this.browserLogin();
        } else if (option === "qrcode") {
            ipcRenderer.send("close-browser-auth-server");
            this.generateQRCode();

            document.getElementById("browserLogin").classList.add("hide");
            document.getElementById("qrcodeLogin").classList.remove("hide");
        }
    }

    logout() {
        ipcRenderer.once('logout-success', () => {
            this.uiManager.showNotification('退出登录成功', 'success');
            location.reload();
        });

        const loginMode = this.getCookie("nbmusic_loginmode");

        if (loginMode === "qrcode") {
            axios
                .post("https://passport.bilibili.com/login/exit/v2", "biliCSRF=" + this.getCookie("bili_jct"), { headers: { "Content-Type": "application/x-www-form-urlencoded" } })
                .then((response) => {
                    if (response.data.code !== 0) {
                        console.error("退出登录失败:", response.data.message);
                        this.uiManager.showNotification("退出登录失败", "error");
                        return;
                    }

                    ipcRenderer.send("logout");
                })
                .catch((error) => {
                    if (error.response) {
                        console.error("退出登录失败：", error.response.data.message);
                    } else if (error.request) {
                        console.error("退出登录失败：服务器没有响应");
                    } else {
                        console.error("退出登录失败：", error.message);
                    }
                    this.uiManager.showNotification("退出登录失败", "error");
                });
        } else {
            ipcRenderer.send("logout");
        }
    }

    browserLogin() {
        try {
            const command = spawn("certutil", ["-user", "-addstore", "Root", path.join(__dirname, "..", "..", "ssl", "ca.crt")]);
            command.on("close", (code) => {
                if (code === 0) {
                    open("https://nbmusic-login.bilibili.com:62687");
                } else {
                    throw new Error("导入根证书失败: " + code);
                }
            });

            fs.readFile("C:\\Windows\\System32\\drivers\\etc\\hosts", "utf8", (err, data) => {
                if (err) {
                    throw new Error("读取Hosts时出错: " + err);
                }

                // 检查文件内容中是否包含指定的字符串
                if (!data.includes("127.0.0.1 nbmusic-login.bilibili.com")) {
                    // 使用mshta提权
                    exec("C:\\Windows\\System32\\mshta.exe " + 'vbscript:createobject("shell.application").shellexecute("' + 'C:\\Windows\\System32\\cmd.exe",' + '"/c echo 127.0.0.1 nbmusic-login.bilibili.com>>C:\\Windows\\system32\\drivers\\etc\\hosts",' + '"","runas",0)(close)');
                }
            });

            ipcRenderer.send("start-browser-auth-server");
        } catch (error) {
            console.error(error.message);
            this.uiManager.showNotification(error.message, "error");
        }
    }
}

module.exports = LoginManager;
