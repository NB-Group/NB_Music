//歌词渲染类
class LyricsPlayer {
    constructor(lyricsString, audioElement) {
        this.lyricsContainer = document.getElementById("lyrics-container");
        this.lyricsContainer.innerHTML = "";
        this.parsedData = this.parseLyrics(lyricsString);
        this.audio = audioElement;
        this.activeLines = new Set();
        this.completedLines = new Set();
        this.animationFrame = null;
        this.lastScrollTime = Date.now();

        // 创建滚动容器
        this.scrollWrapper = document.createElement("div");
        this.scrollWrapper.className = "lyrics-scroll-wrapper";
        this.lyricsContainer.appendChild(this.scrollWrapper);

        // 初始化transform相关变量
        this.currentTransformY = 0;
        this.targetTransformY = 0;
        this.animating = false;

        // 绑定audio事件
        this.audio.addEventListener("play", () => this.start());
        this.audio.addEventListener("pause", () => this.stop());
        this.audio.addEventListener("seeking", () => this.onSeek());

        this.init();
    }

    changeLyrics(newLyricsString) {
        this.stop();
        this.activeLines.clear();
        this.completedLines.clear();
        this.scrollWrapper.innerHTML = "";
        this.parsedData = this.parseLyrics(newLyricsString);
        this.init();
        if (!this.audio.paused) {
            this.start();
        }
    }

    parseLyrics(lyricsString) {
        if (!lyricsString) {
            return [
                {
                    type: "lyric",
                    lineStart: 0,
                    lineDuration: 5000,
                    chars: [{ text: "暂无歌词", startTime: 0, duration: 5000 }]
                }
            ];
        }

        const lines = lyricsString.split("\n");
        const parsedData = [];

        // 检查是否为传统时间戳格式
        const isTraditionalFormat = lines.some((line) => line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/));

        if (isTraditionalFormat) {
            lines.forEach((line) => {
                if (line.trim() === "") return;
                const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
                if (match) {
                    const [, mm, ss, ms, text] = match;
                    const startTime = (parseInt(mm) * 60 + parseInt(ss)) * 1000 + parseInt(ms);
                    parsedData.push({
                        type: "lyric",
                        lineStart: startTime,
                        lineDuration: 5000,
                        chars: [
                            {
                                text: text.trim(),
                                startTime: startTime,
                                duration: 5000
                            }
                        ]
                    });
                }
            });
        } else {
            lines.forEach((line) => {
                if (line.trim() === "") return;
                if (line.startsWith("{")) {
                    const metadata = JSON.parse(line);
                    parsedData.push({
                        type: "metadata",
                        time: metadata.t,
                        content: metadata.c
                    });
                    return;
                }
                if (line.startsWith("[")) {
                    const timeMatch = line.match(/\[(\d+),(\d+)\]/);
                    const charMatches = line.match(/\((\d+),(\d+),\d+\)([^(]+)/g);
                    if (timeMatch && charMatches) {
                        const lineStart = parseInt(timeMatch[1]);
                        const lineDuration = parseInt(timeMatch[2]);
                        const chars = charMatches.map((charMatch) => {
                            const [, startTime, duration, text] = charMatch.match(/\((\d+),(\d+),\d+\)(.+)/);
                            return {
                                text,
                                startTime: parseInt(startTime),
                                duration: parseInt(duration)
                            };
                        });
                        parsedData.push({
                            type: "lyric",
                            lineStart,
                            lineDuration,
                            chars
                        });
                    }
                }
            });
        }
        return parsedData;
    }

    createLyricElement(lyricData) {
        const lineDiv = document.createElement("div");
        lineDiv.className = "lyric-line";

        if (lyricData.chars.length === 1 && lyricData.chars[0].text === lyricData.chars[0].text.trim()) {
            const charSpan = document.createElement("span");
            charSpan.className = "char";
            charSpan.textContent = lyricData.chars[0].text;
            lineDiv.appendChild(charSpan);
        } else {
            lyricData.chars.forEach((char) => {
                const charSpan = document.createElement("span");
                charSpan.className = "char";
                charSpan.textContent = char.text;
                lineDiv.appendChild(charSpan);
            });
        }
        return lineDiv;
    }

    createMetadataElement(metadata) {
        const div = document.createElement("div");
        div.className = "metadata";
        metadata.content.forEach((item) => {
            const span = document.createElement("span");
            span.textContent = item.tx;
            div.appendChild(span);
        });
        return div;
    }

    init() {
        this.lyricsContainer.style.position = "relative";
        this.lyricsContainer.style.overflow = "hidden";
        this.scrollWrapper.style.transform = "translateY(0)";
        this.currentTransformY = 0;
        this.targetTransformY = 0;

        this.parsedData.forEach((data) => {
            const element = data.type === "metadata" ? this.createMetadataElement(data) : this.createLyricElement(data);
            this.scrollWrapper.appendChild(element);
        });
    }

    start() {
        this.animate();
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    onSeek() {
        this.activeLines.clear();
        this.completedLines.clear();
        Array.from(this.scrollWrapper.querySelectorAll(".char")).forEach((char) => {
            char.classList.remove("active", "completed");
        });
    }

    animate() {
        if (!this.scrollWrapper) return;
        const currentTime = this.audio.currentTime * 1000;
        let lastActiveLine = null;
        let lastActiveIndex = -1;
    
        this.parsedData.forEach((data, dataIndex) => {
            if (data.type === "lyric") {
                const line = this.scrollWrapper.children[dataIndex];
                if (!line) return;
    
                const chars = Array.from(line.children);
                let hasActiveLine = false;
                let allCompleted = true;
    
                data.chars.forEach((char, index) => {
                    const charElement = chars[index];
                    const charStartTime = char.startTime;
                    const charEndTime = char.startTime + char.duration;
    
                    if (currentTime >= charStartTime && currentTime <= charEndTime) {
                        charElement.classList.add("active");
                        charElement.classList.remove("completed");
                        hasActiveLine = true;
                        allCompleted = false;
                    } else if (currentTime > charEndTime) {
                        charElement.classList.remove("active");
                        charElement.classList.add("completed");
                    } else {
                        charElement.classList.remove("active", "completed");
                        allCompleted = false;
                    }
                });
    
                if (hasActiveLine) {
                    lastActiveLine = line;
                    lastActiveIndex = dataIndex;
                }
    
                // 先移除所有行的active状态
                line.classList.remove("active");
                this.activeLines.delete(dataIndex);
    
                if (allCompleted) {
                    this.completedLines.add(dataIndex);
                }
            }
        });
    
        // 只激活最后一个活跃行
        if (lastActiveLine) {
            lastActiveLine.classList.add("active");
            this.activeLines.clear();
            this.activeLines.add(lastActiveIndex);
            this.scrollToActiveLine(lastActiveLine);
        }
    
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    scrollToActiveLine(activeLine) {
        const now = Date.now();
        if (now - this.lastScrollTime < 50) return;

        const containerHeight = this.lyricsContainer.clientHeight;
        const lineOffset = activeLine.offsetTop;
        const lineHeight = activeLine.offsetHeight;

        this.targetTransformY = -(lineOffset - (containerHeight - lineHeight) / 2);

        if (!this.animating) {
            this.animating = true;
            this.smoothScroll();
        }

        this.lastScrollTime = now;
    }

    smoothScroll() {
        const diff = this.targetTransformY - this.currentTransformY;
        const delta = diff * 0.15;

        if (Math.abs(diff) < 0.5) {
            this.animating = false;
            return;
        }

        this.currentTransformY += delta;
        this.scrollWrapper.style.transform = `translateY(${this.currentTransformY}px)`;

        requestAnimationFrame(() => this.smoothScroll());
    }
}

module.exports = LyricsPlayer;