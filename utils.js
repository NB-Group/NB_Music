function createObservableArray(callback) {
    return new Proxy([], {
        set(target, property, value) {
            const oldValue = target[property];
            target[property] = value;
            callback({
                type: "set",
                property,
                oldValue,
                newValue: value
            });
            return true;
        },
        get(target, property) {
            const value = target[property];
            if (typeof value === "function") {
                return function (...args) {
                    const oldLength = target.length;
                    const result = value.apply(target, args);
                    callback({
                        type: "method",
                        method: property,
                        args,
                        oldLength,
                        newLength: target.length
                    });
                    return result;
                };
            }
            return value;
        }
    });
}

async function cropImageToSquare(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // 处理跨域图片

        img.onload = () => {
            // 创建 canvas
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // 计算正方形尺寸和裁剪位置
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;

            // 设置 canvas 尺寸
            canvas.width = size;
            canvas.height = size;

            // 绘制裁剪后的图片
            ctx.drawImage(img, x, y, size, size, 0, 0, size, size);

            // 转换为图片 URL
            resolve({
                url: canvas.toDataURL("image/jpeg"),
                size: `${size}x${size}`
            });
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageUrl;
    });
}

function extractMusicTitle(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // 扩展正则表达式以包含更多类型的括号和引号
    const bracketsRegex = /<[^>]+>|《[^》]+》|\[[^\]]+\]|【[^】]+】|「[^」]+」|『[^』]+』|（[^）]+）|\([^)]+\)/g;
    let matches = input.match(bracketsRegex) || [];
    
    // 如果没有匹配到任何括号内容，返回原始输入（去除首尾空格）
    if (matches.length === 0) {
        return input.trim();
    }
    
    matches = matches.map(match => {
        // 去掉首尾的括号字符
        return match.slice(1, -1);
    });

    return matches.filter(item => item && item.trim()).join(' ');
}
async function getImageDimensions(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve(`${img.width}x${img.height}`);
        };
        img.onerror = () => {
            reject(new Error("Failed to load image"));
        };
        img.src = imageUrl;
    });
}

module.exports = {
    createObservableArray,
    cropImageToSquare,
    extractMusicTitle,
    getImageDimensions
};
