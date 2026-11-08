# 流体背景来源

核对日期：2026-11-07。

本目录的 `shaders.ts` 以及 `renderer.ts` 中速度/染色平流、旋度、散度、压力和梯度求解，改编自 [DavidHDev/react-bits 的 SplashCursor](https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/SplashCursor/SplashCursor.jsx)（[官方效果页](https://reactbits.dev/animations/splash-cursor)）。原始官方源码下载后阅读、裁剪并改为 TypeScript；没有安装依赖或执行下载的脚本。

上游采用 **MIT + Commons Clause License Condition v1.0**，不是纯 MIT。全文及版权声明保留在 [LICENSE.md](LICENSE.md)。本目录用于当前网站内的背景表现，不作为独立组件包、模板或托管组件工具出售/再分发。

本地修改：限定橄榄/暖金/奶油色；删除彩虹、点击爆炸、自动初始注入、触摸、多指、辉光链及通用外观参数；模拟短边96、染色短边256、10次压力求解、8个固定半浮点纹理，输出DPR不超过1.5且最长边不超过1800；只在鼠标移动后初始化。生命周期控制重写为容器内输入、逐帧合并事件、2.5秒静止停止、离屏/隐藏/不适用时释放，以及resize和WebGL丢失清理；着色失败静默保留原静态背景。

设备门控按hover与精确指针能力判断，不按窗口宽度判断；有鼠标的窄桌面/内嵌预览同样开启。无hover、粗指针、系统减少动态偏好继续禁用，并忽略混合设备的touch事件。

原始读取快照 SHA-256：源码 `98d42b703b3242f362f221901381d0bec9d4229ea0dfdfc4ae893c6ef97109c7`，许可 `4bdd1fa59a6b7d5954bc3b213dbc34e455c635a94bbcecf9293553797d0fad02`。
